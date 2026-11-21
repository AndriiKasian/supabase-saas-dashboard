import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
};

// Verifies the signed access token (JWT) for the current request and returns
// a narrow user, or null when there is no valid session. getClaims validates
// the signature (locally with asymmetric keys, otherwise via the Auth server),
// unlike getSession, which only decodes cookie contents and must not be
// trusted.
//
// React cache dedupes calls within a single request only; nothing is shared
// between requests or users.
export const getUser = cache(async (): Promise<CurrentUser | null> => {
  // Identity checks must run for a real request only. Reading cookies() alone
  // is not enough with Partial Prefetching: the per-session App Shell is
  // prerendered at runtime, where Supabase's Date.now() expiry check is
  // rejected. connection() excludes everything below from every prerender.
  await connection();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;

  return { id: data.claims.sub, email: data.claims.email ?? null };
});

// For pages and Server Actions: the verified user, or a redirect to /login.
export const requireUser = cache(async (): Promise<CurrentUser> => {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
});
