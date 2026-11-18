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

// Status colours: dot in each row and the subtle badge next to it.
export const STATUS_DOT_CLASSES: Record<TaskStatus, string> = {
  todo: "bg-zinc-400 dark:bg-zinc-500",
  in_progress: "bg-blue-500",
  done: "bg-green-500",
};

export const STATUS_BADGE_CLASSES: Record<TaskStatus, string> = {
  todo: "border-border bg-muted text-muted-foreground",
  in_progress:
    "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  done: "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
};

const dueDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

// "2026-01-10" -> "Jan 10, 2026". Due dates are calendar dates, so format in
// UTC to get the same output on the server and in every browser.
export function formatDueDate(date: string) {
  return dueDateFormat.format(new Date(`${date}T00:00:00Z`));
}

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
