import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Requests per student per rolling hour, across all AI features. */
export const AI_REQUESTS_PER_HOUR = 60;

/**
 * Counts one AI request for the signed-in student.
 * Returns false when the student is over the limit.
 */
export async function consumeAiQuota(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_ai_quota", {
    p_window_seconds: 3600,
    p_limit: AI_REQUESTS_PER_HOUR,
  });
  if (error) {
    // Fail closed: without a working counter we cannot enforce the limit.
    console.error("consume_ai_quota failed", error.message);
    return false;
  }
  return data !== -1;
}

/**
 * Whether the signed-in student may use the tutor, revision generation and
 * exam marking: trial still running or a paid plan. Lessons are not gated.
 */
export async function hasAiAccess(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_ai_access");
  if (error) {
    console.error("has_ai_access failed", error.message);
    return false;
  }
  return data === true;
}

/** Response for AI routes when the trial is over and there is no plan. */
export const PLAN_REQUIRED = { error: "plan_required" } as const;
