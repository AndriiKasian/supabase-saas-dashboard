// POST /functions/v1/task-insights -> { overdue, eligible, overduePercentage }
// for the calling user. Ignores dashboard filters and pagination.
//
// Auth: the gateway's legacy JWT check is off (verify_jwt = false in
// config.toml) because this project signs user JWTs with asymmetric keys.
// Instead the caller's access token is verified here with getClaims, which
// checks the signature and expiry against the project's JWKS (and falls back
// to the Auth server for legacy symmetric tokens). Queries then run through a
// client carrying that same token, so RLS applies. No secret or service-role
// key is used, and the request body is never read.
import { createClient } from "@supabase/supabase-js";

const OPEN_STATUSES = ["todo", "in_progress"];

// Bearer tokens (not cookies) authenticate the call, so a wildcard origin
// grants nothing on its own; it lets the browser app call this via
// supabase.functions.invoke. Credentials mode is never enabled.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};
const HEADERS = { ...CORS, "Cache-Control": "no-store" };

const json = (body: unknown, status = 200, extra: HeadersInit = {}) =>
  Response.json(body, { status, headers: { ...HEADERS, ...extra } });

// Locally and on hosted projects the runtime injects the publishable keys as
// JSON; SUPABASE_ANON_KEY is the legacy fallback. Both are public keys.
function publicKey(): string | undefined {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    if (typeof keys.default === "string") return keys.default;
  } catch {
    // fall through
  }
  return Deno.env.get("SUPABASE_ANON_KEY");
}

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, {
      Allow: "POST, OPTIONS",
    });
  }

  const token = req.headers
    .get("Authorization")
    ?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return json({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const key = publicKey();
  if (!url || !key) throw new Error("missing Supabase environment");

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Rejects bad signatures, expired tokens and non-user tokens (e.g. the
  // legacy anon key, which is a valid JWT without a user).
  const { data, error } = await supabase.auth.getClaims(token);
  const claims = data?.claims;
  if (
    error ||
    !claims ||
    claims.role !== "authenticated" ||
    typeof claims.sub !== "string"
  ) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Calendar dates are compared in UTC, the same convention the dashboard
  // uses for "Overdue": a task due today is not overdue.
  const today = new Date().toISOString().slice(0, 10);

  // Two count-only (HEAD) queries: PostgreSQL returns exact counts and no
  // rows are transferred, so the 1000-row API limit does not apply. RLS
  // limits rows to the caller; the user_id filter (from the verified token)
  // matches the (user_id, status, due_date) index.
  const openTasks = () =>
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", claims.sub)
      .in("status", OPEN_STATUSES);
  const [overdueResult, eligibleResult] = await Promise.all([
    openTasks().lt("due_date", today),
    openTasks().not("due_date", "is", null),
  ]);

  for (const r of [overdueResult, eligibleResult]) {
    if (r.error || r.count === null) {
      // Log the code only; never send database details to the client.
      console.error("task-insights query failed:", r.error?.code ?? "no count");
      return json({ error: "Internal server error" }, 500);
    }
  }

  const overdue = overdueResult.count ?? 0;
  const eligible = eligibleResult.count ?? 0;
  // Rounded to one decimal; scaled before dividing so halves round exactly.
  const overduePercentage =
    eligible === 0 ? 0 : Math.round((overdue * 1000) / eligible) / 10;

  return json({ overdue, eligible, overduePercentage });
}

Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    console.error("task-insights failed:", e instanceof Error ? e.name : "unknown");
    return json({ error: "Internal server error" }, 500);
  }
});
