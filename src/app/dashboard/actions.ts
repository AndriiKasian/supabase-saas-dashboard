"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TASK_STATUSES, type TaskFields, type TaskFormState } from "./tasks";

// Every action verifies the user first (requireUser redirects to /login
// otherwise). user_id always comes from the verified token, never the form;
// RLS enforces the same ownership rule in the database.

const taskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter a title.")
    .max(200, "Use at most 200 characters."),
  description: z
    .string()
    .trim()
    .max(2000, "Use at most 2000 characters.")
    .transform((v) => v || null),
  status: z.enum(TASK_STATUSES, "Choose a valid status."),
  due_date: z
    .union([z.literal(""), z.iso.date("Enter a valid date.")])
    .transform((v) => v || null),
});

const idSchema = z.uuid();

const NOT_FOUND = "This task no longer exists or you don't have access to it.";
const DB_ERROR = "Something went wrong. Please try again.";

function readTaskForm(formData: FormData) {
  const values = {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    status: String(formData.get("status") ?? ""),
    due_date: String(formData.get("due_date") ?? ""),
  };
  const result = taskSchema.safeParse(values);
  if (result.success) return { values, data: result.data };

  const fieldErrors: TaskFormState["fieldErrors"] = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as TaskFields;
    fieldErrors[field] ??= issue.message;
  }
  return { values, fieldErrors };
}

function dbError(error: { code: string }): TaskFormState {
  // Log the code only; messages may echo user input.
  console.error("tasks mutation failed:", error.code);
  return { error: DB_ERROR };
}

export async function createTask(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const user = await requireUser();
  const { values, data, fieldErrors } = readTaskForm(formData);
  if (!data) return { fieldErrors, values };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .insert({ ...data, user_id: user.id });
  if (error) return { ...dbError(error), values };

  refresh();
  return { ok: true };
}

export async function updateTask(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const user = await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: NOT_FOUND };

  const { values, data, fieldErrors } = readTaskForm(formData);
  if (!data) return { fieldErrors, values };

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("tasks")
    .update(data)
    .eq("id", id.data)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { ...dbError(error), values };
  if (rows.length === 0) return { error: NOT_FOUND, values };

  refresh();
  return { ok: true };
}

export async function setTaskStatus(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const user = await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  const status = taskSchema.shape.status.safeParse(formData.get("status"));
  if (!id.success) return { error: NOT_FOUND };
  if (!status.success) return { error: "Choose a valid status." };

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("tasks")
    .update({ status: status.data })
    .eq("id", id.data)
    .eq("user_id", user.id)
    .select("id");
  if (error) return dbError(error);
  if (rows.length === 0) return { error: NOT_FOUND };

  refresh();
  return { ok: true };
}

export async function deleteTask(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const user = await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: NOT_FOUND };

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id.data)
    .eq("user_id", user.id)
    .select("id");
  if (error) return dbError(error);
  if (rows.length === 0) return { error: NOT_FOUND };

  refresh();
  return { ok: true };
}
