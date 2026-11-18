import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        Supabase SaaS Dashboard
      </h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Project scaffold is ready. Features are coming soon.
      </p>
      <div className="mt-2 flex gap-4 text-sm">
        <Link href="/login" className="underline underline-offset-4">
          Sign in
        </Link>
        <Link href="/signup" className="underline underline-offset-4">
          Create account
        </Link>
      </div>
    </main>
  );
}
