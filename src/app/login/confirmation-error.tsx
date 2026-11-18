"use client";

import { useSearchParams } from "next/navigation";

export function ConfirmationError() {
  const error = useSearchParams().get("error");
  if (error !== "confirmation") return null;

  return (
    <p role="alert" className="text-sm text-destructive">
      We couldn&apos;t complete sign-in from that link. It may have expired or
      been opened in a different browser. If your email is confirmed, sign in
      below.
    </p>
  );
}
