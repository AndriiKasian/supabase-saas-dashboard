import { TASK_STATUSES, type TaskStatus } from "@/app/dashboard/tasks";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type TaskSummary = { total: number } & Record<TaskStatus, number>;

// User-specific: never stored by browsers, CDNs or proxies.
const NO_STORE = { "Cache-Control": "no-store" };

// GET /api/tasks/summary -> { total, todo, in_progress, done } for the
// signed-in user. Ignores dashboard filters and pagination.
//
// Counting: one COUNT per status (head requests, run in parallel). Each
// returns only an exact count computed in PostgreSQL, so no task rows are
// transferred and the PostgREST row limit (1000) does not apply. Fetching the
// status column and counting in JS would be one request but would silently
// stop at 1000 rows. total is the sum, since the CHECK constraint allows only
// these three statuses. The three counts are separate statements, so a write
// landing between them can skew one snapshot slightly; fine for a summary.
export async function GET() {
  // Reads the request cookies, so the handler is always evaluated per
  // request (never prerendered).
  const user = await getUser();
  if (!user) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  const supabase = await createClient();
  // RLS limits rows to the owner; the user_id filter (always the verified
  // user, never request input) also matches the (user_id, status, ...) index.
  const results = await Promise.all(
    TASK_STATUSES.map((status) =>
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", status),
    ),
  );

  const failed = results.find((r) => r.error || r.count === null);
  if (failed) {
    // Log the code only; never send database details to the client.
    console.error("task summary failed:", failed.error?.code ?? "no count");
    return Response.json(
      { error: "Internal server error" },
      { status: 500, headers: NO_STORE },
    );
  }

  const counts = Object.fromEntries(
    TASK_STATUSES.map((status, i) => [status, results[i].count ?? 0]),
  ) as Record<TaskStatus, number>;
  const summary: TaskSummary = {
    total: counts.todo + counts.in_progress + counts.done,
    ...counts,
  };
  return Response.json(summary, { headers: NO_STORE });
}
