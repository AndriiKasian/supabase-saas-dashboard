import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in · Supabase SaaS Dashboard",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Sign-in is coming soon.
      </p>
    </main>
  );
}
