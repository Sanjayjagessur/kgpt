import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/server/supabase-admin";

export function newInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type InviteLookup =
  | { state: "invalid" }
  | { state: "expired" }
  | { state: "paid" | "open"; inviteId: string; studentId: string; studentName: string };

/**
 * Finds the invite behind a parent link (service role: the parent isn't signed in).
 * Returns only what the parent page shows: the student's display name.
 */
export async function lookupInvite(token: string): Promise<InviteLookup> {
  if (!TOKEN_PATTERN.test(token)) return { state: "invalid" };
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("parent_invites")
    .select("id, student_id, expires_at, profiles(display_name)")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();
  if (!invite) return { state: "invalid" };

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("status")
    .eq("student_id", invite.student_id)
    .maybeSingle();
  const base = { inviteId: invite.id, studentId: invite.student_id, studentName: invite.profiles?.display_name ?? "" };
  if (subscription && ["active", "trialing", "past_due"].includes(subscription.status)) return { state: "paid", ...base };
  if (new Date(invite.expires_at).getTime() < Date.now()) return { state: "expired" };
  return { state: "open", ...base };
}
