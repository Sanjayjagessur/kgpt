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
