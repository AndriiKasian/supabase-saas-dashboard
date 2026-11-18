import type { Metadata } from "next";
import { Suspense, cache } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AccountMenu } from "./account-menu";
import { FilterIcon, LayersIcon } from "./icons";
import { NewTaskButton } from "./task-dialog";
import { TaskFilters as TaskFiltersForm } from "./task-filters";
import { TaskItem } from "./task-item";
import type { Task, TaskFilters } from "./tasks";

export const metadata: Metadata = {
  title: "My Tasks · TaskFlow",
};

// Loads everything the dashboard shows. React cache shares one result per
// request between the header, filters and list; nothing is shared between
// requests or users.
const loadDashboard = cache(async () => {
  const user = await requireUser();
  const supabase = await createClient();

  // Saved filters; no row yet means the defaults (all tasks).
  const { data: prefs, error: prefsError } = await supabase
    .from("user_preferences")
    .select("status_filter, date_from, date_to")
    .eq("user_id", user.id)
    .maybeSingle()
    .overrideTypes<TaskFilters | null, { merge: false }>();
  const filters: TaskFilters = prefs ?? {
    status_filter: null,
    date_from: null,
    date_to: null,
  };

  // RLS limits rows to the owner; the user_id filter also matches the
  // indexes. gte/lte never match a NULL due_date, so tasks without one are
  // excluded whenever a date bound is set.
  let query = supabase
    .from("tasks")
    .select("id, title, description, status, due_date, created_at")
    .eq("user_id", user.id);
  if (filters.status_filter) query = query.eq("status", filters.status_filter);
  if (filters.date_from) query = query.gte("due_date", filters.date_from);
  if (filters.date_to) query = query.lte("due_date", filters.date_to);
  const { data: tasks, error: tasksError } = await query
    .order("created_at", { ascending: false })
    // status is TEXT + CHECK in the database, so narrow it to TaskStatus.
    .overrideTypes<Task[], { merge: false }>();

  return {
    user,
    filters,
    prefsFailed: Boolean(prefsError),
    filtered: Boolean(
      filters.status_filter || filters.date_from || filters.date_to,
    ),
    tasks: tasksError ? null : tasks,
    // Request time is guaranteed (requireUser awaits connection()). Overdue
    // is judged against the server's UTC date.
    today: new Date().toISOString().slice(0, 10),
  };
});

// Static shell: header, headings, the New task button and fallbacks.
// Everything user-specific streams in per request behind Suspense.
export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-8">
      <header className="flex h-16 items-center justify-between gap-4 border-b sm:h-20">
        <p className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
          <LayersIcon className="size-6" />
          TaskFlow
        </p>
        <Suspense fallback={null}>
          <Account />
        </Suspense>
      </header>

      <main className="flex flex-1 flex-col gap-8 py-8 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-3xl font-semibold tracking-tight">My Tasks</h1>
            <p className="text-muted-foreground">
              Organize your work, stay focused.
            </p>
          </div>
          <NewTaskButton />
        </div>

        <section aria-labelledby="filters-heading" className="flex flex-col gap-4">
          <h2
            id="filters-heading"
            className="flex items-center gap-2.5 text-lg font-medium"
          >
            <FilterIcon className="size-5 text-muted-foreground" />
            Filters
          </h2>
          <Suspense fallback={<FiltersSkeleton />}>
            <Filters />
          </Suspense>
        </section>

        <section
          aria-labelledby="tasks-heading"
          className="overflow-hidden rounded-xl border bg-card"
        >
          <div className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
            <h2 id="tasks-heading" className="text-lg font-semibold">
              All tasks
            </h2>
            <Suspense fallback={null}>
              <TaskCount />
            </Suspense>
          </div>
          <Suspense fallback={<ListSkeleton />}>
            <TaskList />
          </Suspense>
        </section>
      </main>
    </div>
  );
}

async function Account() {
  const { user } = await loadDashboard();
  return <AccountMenu email={user.email ?? "Unknown user"} />;
}

async function TaskCount() {
  const { tasks, filtered } = await loadDashboard();
  if (!tasks) return null;
  const noun = tasks.length === 1 ? "task" : "tasks";
  return (
    <span className="text-sm text-muted-foreground tabular-nums">
      {tasks.length} {filtered ? `matching ${noun}` : noun}
    </span>
  );
}

async function Filters() {
  const { filters, prefsFailed } = await loadDashboard();
  return (
    <div className="flex flex-col gap-3">
      {prefsFailed && (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t load your saved filters. Showing all tasks.{" "}
          <a href="/dashboard" className="underline underline-offset-4">
            Reload the page
          </a>{" "}
          to try again.
        </p>
      )}
      <TaskFiltersForm
        key={`${filters.status_filter}|${filters.date_from}|${filters.date_to}`}
        filters={filters}
        // Saving now could overwrite preferences we failed to read.
        disabled={prefsFailed}
      />
    </div>
  );
}

async function TaskList() {
  const { tasks, filtered, today } = await loadDashboard();

  if (!tasks) {
    return (
      <p role="alert" className="px-6 py-12 text-center text-sm text-destructive">
        Couldn&apos;t load your tasks.{" "}
        <a href="/dashboard" className="underline underline-offset-4">
          Reload the page
        </a>{" "}
        to try again.
      </p>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
        <p className="font-medium">
          {filtered ? "No matching tasks" : "No tasks yet"}
        </p>
        <p className="text-sm text-muted-foreground">
          {filtered
            ? "Adjust or reset the filters above to see more tasks."
            : "Use “New task” to create your first one."}
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y">
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} today={today} />
      ))}
    </ul>
  );
}

function FiltersSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid gap-3 sm:grid-cols-3 lg:grid-cols-[1.15fr_1fr_1fr_auto]"
    >
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[58px] rounded-lg border bg-muted/40" />
      ))}
      <div className="h-10 rounded-lg bg-muted/40 sm:col-span-3 lg:col-span-1 lg:w-52 lg:self-center" />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div role="status" className="divide-y">
      <span className="sr-only">Loading tasks…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-5 sm:px-6">
          <div className="size-3 rounded-full bg-muted" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3.5 w-1/3 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted/60" />
          </div>
          <div className="hidden h-5 w-24 rounded-full bg-muted/60 sm:block" />
        </div>
      ))}
    </div>
  );
}
