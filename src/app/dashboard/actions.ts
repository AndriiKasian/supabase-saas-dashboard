"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  TASK_STATUSES,
  type FilterFields,
  type FilterFormState,
  type TaskFields,
  type TaskFormState,
} from "./tasks";

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

const optionalDate = z
  .union([z.literal(""), z.iso.date("Enter a valid date.")])
  .transform((v) => v || null);

const filtersSchema = z
  .object({
    status_filter: z
      .union([z.literal(""), z.enum(TASK_STATUSES)], "Choose a valid status.")
      .transform((v) => v || null),
    date_from: optionalDate,
    date_to: optionalDate,
  })
  .refine((f) => !f.date_from || !f.date_to || f.date_from <= f.date_to, {
    path: ["date_to"],
    message: "End date must be on or after the start date.",
  });

// Saves the dashboard filters as the user's preferences. The submit button
// named "intent" with value "reset" stores the defaults instead.
export async function saveFilters(
  _prev: FilterFormState,
  formData: FormData,
): Promise<FilterFormState> {
  const user = await requireUser();
  const reset = formData.get("intent") === "reset";
  const values = {
    status_filter: reset ? "" : String(formData.get("status_filter") ?? ""),
    date_from: reset ? "" : String(formData.get("date_from") ?? ""),
    date_to: reset ? "" : String(formData.get("date_to") ?? ""),
  };

  const result = filtersSchema.safeParse(values);
  if (!result.success) {
    const fieldErrors: FilterFormState["fieldErrors"] = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as FilterFields;
      fieldErrors[field] ??= issue.message;
    }
    return { fieldErrors, values };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: user.id, ...result.data }, { onConflict: "user_id" });
  if (error) {
    console.error("preferences upsert failed:", error.code);
    return { error: DB_ERROR, values };
  }

  refresh();
  return {};
}
