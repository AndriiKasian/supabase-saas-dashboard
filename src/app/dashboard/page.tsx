import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Dashboard · Supabase SaaS Dashboard",
};

// The heading and fallback are the only parts prerendered into the static
// shell. Everything user-specific renders per request behind Suspense.
export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <Suspense
        fallback={<p className="text-zinc-600 dark:text-zinc-400">Loading…</p>}
      >
        <DashboardContent />
      </Suspense>
    </main>
  );
}

async function DashboardContent() {
  const user = await requireUser();

  return (
    <p className="text-zinc-600 dark:text-zinc-400">
      Signed in as {user.email ?? "unknown user"}. Dashboard features are
      coming soon.
    </p>
  );
}
