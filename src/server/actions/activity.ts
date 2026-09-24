"use server";

import { createClient } from "@/lib/supabase/server";
import { getStudent } from "@/server/session";

/** Adds active study seconds to today's total. Capped server-side at 15 min per call. */
export async function logStudyTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const student = await getStudent();
  if (!student) return;
  const supabase = await createClient();
  await supabase.rpc("log_study_time", { p_seconds: Math.min(Math.round(seconds), 900) });
}
