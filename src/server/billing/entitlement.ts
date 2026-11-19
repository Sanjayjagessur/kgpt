import "server-only";

import { cache } from "react";
import type { SubscriptionRow } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { getStudent } from "@/server/session";

export type Entitlement = {
  /** trial: free days left; active: a paid plan; expired: lessons only. */
  state: "trial" | "active" | "expired";
  trialEndsAt: string;
  /** Whole days left in the trial (0 once it has ended). */
  trialDaysLeft: number;
  subscription: Pick<SubscriptionRow, "status" | "plan" | "current_period_end" | "cancel_at"> | null;
};

const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);
const DAY_MS = 24 * 60 * 60 * 1000;

/** What the signed-in student can use. Mirrors `public.has_ai_access()`. Deduplicated per request. */
export const getEntitlement = cache(async (): Promise<Entitlement | null> => {
  const student = await getStudent();
  if (!student) return null;

  const supabase = await createClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, plan, current_period_end, cancel_at")
    .eq("student_id", student.id)
    .maybeSingle();

  const trialEndsAt = student.profile.trial_ends_at;
  const msLeft = new Date(trialEndsAt).getTime() - Date.now();
  const trialDaysLeft = Math.max(0, Math.ceil(msLeft / DAY_MS));

  const state = subscription && PAID_STATUSES.has(subscription.status) ? "active" : msLeft > 0 ? "trial" : "expired";
  return { state, trialEndsAt, trialDaysLeft, subscription: subscription ?? null };
});
