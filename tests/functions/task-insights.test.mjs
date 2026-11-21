// Integration tests for the task-insights Edge Function (node:test, no extra
// deps). Runs against a LOCAL Supabase stack only:
//   1. corepack pnpm dlx supabase@3.2.0 start
//   2. corepack pnpm dlx supabase@3.2.0 functions serve
//   3. SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_PUBLISHABLE_KEY=<local key> \
//      [SUPABASE_JWT_SECRET=<local JWT secret>] corepack pnpm test:functions
//
// Each run signs up disposable users with random passwords (email
// confirmation is off locally) and deletes them afterwards (their tasks
// cascade) through the local Docker database. The database-failure test
// temporarily revokes SELECT on public.tasks there and always restores it.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { createClient } from "@supabase/supabase-js";

const API = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const DB_CONTAINER = "supabase_db_supabase-saas-dashboard";

assert.ok(API && KEY, "Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (local)");
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(API).hostname),
  "Refusing to run against a non-local Supabase project",
);
const FN = `${API}/functions/v1/task-insights`;

const psql = (sql) =>
  execFileSync("docker", [
    "exec", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-qtAX", "-c", sql,
  ]);

// Fixed dates keep results independent of the clock; only the due-today
// test depends on the current UTC date (and retries across midnight).
const PAST = "2000-01-01";
const FUTURE = "2999-12-31";
const utcToday = () => new Date().toISOString().slice(0, 10);

const created = [];

// A disposable user; `rows` are [count, status, due_date] groups inserted
// with the user's own token (RLS applies).
async function newUser(tag, rows = []) {
  const client = createClient(API, KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signUp({
    email: `${tag}-${randomUUID()}@example.test`,
    password: randomUUID(),
  });
  if (error) throw error;
  assert.ok(data.session, "sign-up did not return a session");
  const id = data.user.id;
  created.push(id);
  const tasks = rows.flatMap(([n, status, due_date]) =>
    Array.from({ length: n }, (_, i) => ({ user_id: id, title: `t${i}`, status, due_date })),
  );
  for (let i = 0; i < tasks.length; i += 500) {
    const { error: insertError } = await client.from("tasks").insert(tasks.slice(i, i + 500));
    if (insertError) throw insertError;
  }
  return { client, id, token: data.session.access_token };
}

async function call(token, { method = "POST", headers = {} } = {}) {
  const res = await fetch(FN, {
    method,
    headers: {
      apikey: KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { res, text, json };
}

// An HS256 JWT without a kid, the shape of legacy-secret tokens.
function hs256(payload, secret) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const data = `${enc({ alg: "HS256", typ: "JWT" })}.${enc(payload)}`;
  return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
}

const insights = (overdue, eligible, overduePercentage) => ({ overdue, eligible, overduePercentage });
let empty, a, b;

before(async () => {
  empty = await newUser("empty", [[2, "done", PAST], [3, "todo", null]]);
  // 3 overdue + 5 future open tasks are eligible; done and undated tasks
  // are excluded.
  a = await newUser("a", [
    [2, "todo", PAST],
    [1, "in_progress", PAST],
    [5, "in_progress", FUTURE],
    [6, "done", PAST],
    [7, "todo", null],
    [8, "in_progress", null],
  ]);
  b = await newUser("b", [[1, "todo", PAST]]);
});

after(() => {
  psql("grant select on public.tasks to authenticated;");
  if (created.length) {
    psql(`delete from auth.users where id in (${created.map((id) => `'${id}'`).join(",")});`);
  }
});

test("zero eligible tasks -> 0 / 0 / 0%", async () => {
  const { res, json } = await call(empty.token);
  assert.equal(res.status, 200);
  assert.deepEqual(json, insights(0, 0, 0));
});

test("overdue vs future; done and undated excluded", async () => {
  assert.deepEqual((await call(a.token)).json, insights(3, 8, 37.5));
});

test("due today is eligible but not overdue", async () => {
  // If UTC midnight passes between seeding and the call, "today" changed
  // under the test: retry with a fresh user (at most once in practice).
  for (let attempt = 0; attempt < 3; attempt++) {
    const today = utcToday();
    const u = await newUser("today", [[2, "todo", today], [1, "in_progress", today], [1, "todo", PAST]]);
    const { json } = await call(u.token);
    if (utcToday() !== today) continue;
    assert.deepEqual(json, insights(1, 4, 25));
    return;
  }
  assert.fail("UTC date kept changing during the test");
});

test("exact contract and JSON content type", async () => {
  const { res, json } = await call(a.token);
  assert.deepEqual(Object.keys(json).sort(), ["eligible", "overdue", "overduePercentage"]);
  assert.match(res.headers.get("content-type"), /^application\/json/);
});

test("percentage is rounded to one decimal", async (t) => {
  for (const [overdue, future, expected] of [[2, 1, 66.7], [1, 2, 33.3], [1, 15, 6.3]]) {
    await t.test(`${overdue}/${overdue + future} -> ${expected}`, async () => {
      const u = await newUser("round", [[overdue, "todo", PAST], [future, "todo", FUTURE]]);
      assert.deepEqual((await call(u.token)).json, insights(overdue, overdue + future, expected));
    });
  }
});

test("more than 1000 tasks are counted exactly", async () => {
  const large = await newUser("large", [
    [700, "todo", PAST],
    [500, "in_progress", FUTURE],
    [300, "done", PAST],
  ]);
  const { data } = await large.client.from("tasks").select("id");
  assert.equal(data.length, 1000, "baseline: plain select is capped");
  assert.deepEqual((await call(large.token)).json, insights(700, 1200, 58.3));
});

test("isolation: each user sees only their own tasks", async () => {
  assert.deepEqual((await call(b.token)).json, insights(1, 1, 100));
  assert.deepEqual((await call(a.token)).json, insights(3, 8, 37.5));
});

test("user_id in body or query is ignored", async () => {
  const res = await fetch(`${FN}?user_id=${b.id}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${a.token}`, "content-type": "application/json" },
    body: JSON.stringify({ user_id: b.id }),
  });
  assert.deepEqual(await res.json(), insights(3, 8, 37.5));
});

test("authentication failures -> 401 JSON with no-store", async (t) => {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const [header, payload, signature] = a.token.split(".");
  const claims = JSON.parse(Buffer.from(payload, "base64url"));
  const cases = {
    "missing Authorization": null,
    "malformed token": "not-a-jwt",
    "publishable key as bearer": KEY,
    "tampered payload (sub = B)": `${header}.${enc({ ...claims, sub: b.id })}.${signature}`,
    "forged signature": `${header}.${payload}.${Buffer.alloc(64).toString("base64url")}`,
    "unknown signing key": `${enc({ alg: "ES256", typ: "JWT", kid: randomUUID() })}.${payload}.AAAA`,
    "HS256 with a wrong secret": hs256(claims, randomUUID()),
  };
  // A correctly signed but expired token needs a signing secret: the local
  // stack's legacy JWT secret (`supabase status`), passed only via env.
  if (process.env.SUPABASE_JWT_SECRET) {
    const exp = Math.floor(Date.now() / 1000) - 60;
    cases["expired (validly signed)"] = hs256({ ...claims, iat: exp - 3600, exp }, process.env.SUPABASE_JWT_SECRET);
  } else {
    t.diagnostic("expired-token case skipped: SUPABASE_JWT_SECRET not set");
  }
  for (const [name, token] of Object.entries(cases)) {
    await t.test(name, async () => {
      const { res, json } = await call(token);
      assert.equal(res.status, 401);
      assert.deepEqual(json, { error: "Unauthorized" });
      assert.equal(res.headers.get("cache-control"), "no-store");
    });
  }
});

test("unsupported methods -> 405 with Allow", async (t) => {
  for (const method of ["GET", "PUT", "DELETE"]) {
    await t.test(method, async () => {
      const { res, json } = await call(a.token, { method });
      assert.equal(res.status, 405);
      assert.equal(res.headers.get("allow"), "POST, OPTIONS");
      assert.equal(res.headers.get("cache-control"), "no-store");
      assert.deepEqual(json, { error: "Method not allowed" });
    });
  }
});

test("CORS preflight", async () => {
  const res = await fetch(FN, {
    method: "OPTIONS",
    headers: {
      origin: "http://localhost:3000",
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization, apikey, content-type, x-client-info",
    },
  });
  assert.ok(res.ok, `status ${res.status}`);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  assert.match(res.headers.get("access-control-allow-methods"), /POST/);
  assert.match(res.headers.get("access-control-allow-headers"), /authorization/);
  assert.equal(res.headers.get("access-control-allow-credentials"), null);
});

test("no caching: no-store, and new data shows on the next call", async () => {
  const first = await call(b.token);
  assert.equal(first.res.headers.get("cache-control"), "no-store");
  const { error } = await b.client
    .from("tasks")
    .insert({ user_id: b.id, title: "new", status: "todo", due_date: FUTURE });
  assert.ifError(error);
  assert.deepEqual((await call(b.token)).json, insights(1, 2, 50));
});

test("database failure -> generic 500 without internals", async () => {
  try {
    psql("revoke select on public.tasks from authenticated;");
    const { res, json, text } = await call(a.token);
    assert.equal(res.status, 500);
    assert.deepEqual(json, { error: "Internal server error" });
    assert.doesNotMatch(text, /42501|permission|denied|tasks|postgres|stack/i);
    assert.equal(res.headers.get("cache-control"), "no-store");
  } finally {
    psql("grant select on public.tasks to authenticated;");
  }
  assert.equal((await call(a.token)).res.status, 200, "works after restore");
});
