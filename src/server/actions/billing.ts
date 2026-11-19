"use server";

import { z } from "zod";
import { billingConfig } from "@/config/billing";
import { createClient } from "@/lib/supabase/server";
import { hashInviteToken, lookupInvite, newInviteToken } from "@/server/billing/invites";
import { getOrigin } from "@/server/origin";
import { getStudent } from "@/server/session";
import { createAdminClient } from "@/server/supabase-admin";

const INVITES_PER_DAY = 10;

/** Creates a parent link for the signed-in student. The raw token is only ever returned here. */
export async function createParentInvite() {
  const student = await getStudent();
  if (!student) return { ok: false as const };

  const supabase = await createClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("parent_invites")
    .select("id", { count: "exact", head: true })
    .eq("student_id", student.id)
    .gte("created_at", since);
  if ((count ?? 0) >= INVITES_PER_DAY) return { ok: false as const };

  const token = newInviteToken();
  const { error } = await supabase
    .from("parent_invites")
    .insert({ student_id: student.id, token_hash: hashInviteToken(token) });
  if (error) {
    console.error("parent invite failed", error.message);
    return { ok: false as const };
  }
  return { ok: true as const, url: `${await getOrigin()}/parent/${token}` };
}

const ConsentSchema = z.object({
  token: z.string(),
  parentName: z.string().trim().min(1).max(80),
  agreed: z.literal(true),
});

/**
 * Records a parent's consent from the parent page (no sign-in; the link's
 * token is the proof). Returns the ids the checkout carries to the webhook.
 */
export async function recordParentConsent(input: z.input<typeof ConsentSchema>) {
  const parsed = ConsentSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid" as const };

  const invite = await lookupInvite(parsed.data.token);
  if (invite.state !== "open") return { ok: false as const, error: invite.state };

  const { data, error } = await createAdminClient()
    .from("parent_consents")
    .insert({
      student_id: invite.studentId,
      invite_id: invite.inviteId,
      parent_name: parsed.data.parentName,
      terms_version: billingConfig.termsVersion,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("parent consent save failed", error?.message);
    return { ok: false as const, error: "save" as const };
  }
  return { ok: true as const, studentId: invite.studentId, consentId: data.id };
}
