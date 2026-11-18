"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
  message?: string;
  email?: string;
};

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

const signupSchema = z.object({
  email,
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(72, "Use at most 72 characters."),
});

function parse<T extends z.ZodType>(schema: T, formData: FormData) {
  const result = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (result.success) return { data: result.data as z.infer<T> };

  const fieldErrors: AuthFormState["fieldErrors"] = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if ((field === "email" || field === "password") && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }
  return { fieldErrors };
}

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const submittedEmail = String(formData.get("email") ?? "");
  const { data, fieldErrors } = parse(loginSchema, formData);
  if (!data) return { fieldErrors, email: submittedEmail };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    const message =
      error.code === "email_not_confirmed"
        ? "Confirm your email address before signing in. Check your inbox for the link."
        : error.code === "invalid_credentials"
          ? "Incorrect email or password."
          : "Could not sign in. Please try again.";
    return { error: message, email: data.email };
  }

  redirect("/dashboard");
}

export async function signup(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const submittedEmail = String(formData.get("email") ?? "");
  const { data, fieldErrors } = parse(signupSchema, formData);
  if (!data) return { fieldErrors, email: submittedEmail };

  // Server Actions reject requests whose Origin does not match the Host, so
  // this is the app's own origin. Supabase also checks it against the
  // project's allowed Redirect URLs.
  const origin = (await headers()).get("origin");

  const supabase = await createClient();
  const { data: result, error } = await supabase.auth.signUp({
    ...data,
    options: origin ? { emailRedirectTo: `${origin}/auth/confirm` } : {},
  });

  if (error) {
    const message =
      error.code === "weak_password"
        ? "Choose a stronger password."
        : error.code === "over_email_send_rate_limit" ||
            error.code === "over_request_rate_limit"
          ? "Too many attempts. Please wait a few minutes and try again."
          : error.code === "user_already_exists"
            ? "An account with this email already exists. Try signing in."
            : "Could not create the account. Please try again.";
    return { error: message, email: data.email };
  }

  // A session is returned only when email confirmation is disabled.
  if (result.session) redirect("/dashboard");

  // With confirmation enabled, Supabase returns the same response whether or
  // not the email is already registered, so this message reveals nothing.
  return {
    message: `Check ${data.email} for a confirmation link to finish signing up.`,
  };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
