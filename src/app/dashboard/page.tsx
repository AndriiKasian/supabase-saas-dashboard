import type { Metadata } from "next";
import { Suspense } from "react";
import { logout } from "@/app/auth/actions";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";
import { TaskForm } from "./task-form";
import { TaskItem } from "./task-item";
import type { Task } from "./tasks";

export const metadata: Metadata = {
  title: "Dashboard · Supabase SaaS Dashboard",
};

// The heading and fallback are the only parts prerendered into the static
// shell. Everything user-specific renders per request behind Suspense.
export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <Suspense
        fallback={<p className="text-muted-foreground">Loading tasks…</p>}
      >
        <DashboardContent />
      </Suspense>
    </main>
  );
}

async function DashboardContent() {
  const user = await requireUser();
  const supabase = await createClient();
  // RLS limits rows to the owner; the user_id filter also matches the
  // (user_id, created_at desc) index.
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, title, description, status, due_date, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    // status is TEXT + CHECK in the database, so narrow it to TaskStatus.
    .overrideTypes<Task[], { merge: false }>();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Signed in as {user.email ?? "unknown user"}
        </p>
        <form action={logout}>
          <LogoutButton />
        </form>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="font-medium">New task</h2>
        <TaskForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Your tasks</h2>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            Couldn&apos;t load your tasks. Please refresh the page.
          </p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tasks yet. Add your first one above.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
