import type { Tables } from "@/lib/supabase/database.types";

// Shared by Server Actions and Client Components. Must match the CHECK
// constraint on public.tasks.status.
export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export type Task = Pick<
  Tables<"tasks">,
  "id" | "title" | "description" | "due_date" | "created_at"
> & { status: TaskStatus };

export type TaskFields = "title" | "description" | "status" | "due_date";

export type TaskFilters = {
  status_filter: TaskStatus | null;
  date_from: string | null;
  date_to: string | null;
};

export type FilterFields = keyof TaskFilters;

export type FilterFormState = {
  error?: string;
  fieldErrors?: Partial<Record<FilterFields, string>>;
  values?: Partial<Record<FilterFields, string>>;
};

export type TaskFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<TaskFields, string>>;
  values?: Partial<Record<TaskFields, string>>;
};
