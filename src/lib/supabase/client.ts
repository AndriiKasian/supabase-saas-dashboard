import { createBrowserClient } from "@supabase/ssr";

// Supabase client for Client Components. createBrowserClient reuses a single
// instance in the browser and stores the session in cookies.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
