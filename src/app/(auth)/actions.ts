"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/server/origin";

export type AuthErrorKey =
  | "invalidEmail"
  | "shortPassword"
  | "invalidCredentials"
  | "emailTaken"
  | "rateLimited"
  | "generic"
  | "setup";

export type AuthState =
  | { status: "idle" }
  | { status: "error"; error: AuthErrorKey; field?: "email" | "password"; email?: string }
  | { status: "check-email"; email: string }
  | { status: "link-sent"; email: string };

const emailSchema = z.email().max(254);
const passwordSchema = z.string().min(8).max(72);

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

function validate(email: string, password: string): AuthState | null {
  if (!isSupabaseConfigured()) return { status: "error", error: "setup" };
  if (!emailSchema.safeParse(email).success)
    return { status: "error", error: "invalidEmail", field: "email", email };
  if (!passwordSchema.safeParse(password).success)
    return { status: "error", error: "shortPassword", field: "password", email };
  return null;
}

function mapError(code: string | undefined, status: number | undefined): AuthErrorKey {
  if (code === "invalid_credentials") return "invalidCredentials";
  if (code === "user_already_exists" || code === "email_exists") return "emailTaken";
  if (status === 429 || code?.startsWith("over_")) return "rateLimited";
  return "generic";
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  const invalid = validate(email, password);
  if (invalid) return invalid;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { status: "error", error: mapError(error.code, error.status), email };

  redirect("/learn");
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  const invalid = validate(email, password);
  if (invalid) return invalid;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await getOrigin()}/auth/callback?next=/onboarding` },
  });
  if (error) return { status: "error", error: mapError(error.code, error.status), email };
  // Supabase returns a user with no identities when the email is already registered.
  if (data.user && data.user.identities?.length === 0) {
    return { status: "error", error: "emailTaken", email };
  }
  if (data.session) redirect("/onboarding");
  return { status: "check-email", email };
}

export async function sendMagicLink(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!isSupabaseConfigured()) return { status: "error", error: "setup" };
  if (!emailSchema.safeParse(email).success)
    return { status: "error", error: "invalidEmail", field: "email", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await getOrigin()}/auth/callback?next=/learn`, shouldCreateUser: true },
  });
  if (error) return { status: "error", error: mapError(error.code, error.status), email };
  return { status: "link-sent", email };
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/sign-in");
}
