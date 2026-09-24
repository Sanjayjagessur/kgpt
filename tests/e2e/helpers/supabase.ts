import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

/** Service-role client for creating and removing throwaway test students. */
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function createTestStudent(tag: string) {
  const admin = adminClient();
  if (!admin) return null;
  const email = `e2e-${tag}-${Date.now()}@example.com`;
  const password = `pw-${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  return { id: data.user.id, email, password };
}

export async function deleteTestStudent(id: string) {
  await adminClient()?.auth.admin.deleteUser(id);
}
