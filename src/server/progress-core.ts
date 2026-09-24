import "server-only";

import type { LessonCheck } from "@/lib/lesson-content";
import { createAdminClient } from "@/server/supabase-admin";

const MASTERY_SCORE = 80;

/**
 * lesson_progress is written only here, with the service role, after the
 * caller has verified the student's session (students have read-only access).
 */

/** Records that the student opened a lesson (drives "Continue where you left off"). */
export async function recordLessonView(userId: string, lessonId: string) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: existing } = await admin
    .from("lesson_progress")
    .select("status")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (existing) {
    await admin.from("lesson_progress").update({ last_viewed_at: now }).eq("user_id", userId).eq("lesson_id", lessonId);
    return;
  }
  const { error } = await admin
    .from("lesson_progress")
    .insert({ user_id: userId, lesson_id: lessonId, status: "in_progress", last_viewed_at: now });
  if (!error) await refreshUnitMastery(userId, lessonId);
}

/** A student's answer: chosen option index (multiple choice) or self-assessment (short answer). */
export type CheckAnswer = number | boolean | null;

/**
 * Scores answers against the stored lesson. Multiple choice is marked on the
 * server; short answers can only be self-assessed against the model answer.
 * Returns null unless every question was answered.
 */
export function scoreAnswers(checks: LessonCheck[], answers: CheckAnswer[]): number | null {
  if (checks.length === 0 || answers.length !== checks.length) return null;
  let correct = 0;
  for (let i = 0; i < checks.length; i++) {
    const check = checks[i];
    const answer = answers[i];
    if (answer === null || answer === undefined) return null;
    if (check.kind === "multiple_choice" && check.options.length > 1) {
      if (typeof answer !== "number") return null;
      if (answer === check.correctOption) correct += 1;
    } else {
      if (typeof answer !== "boolean") return null;
      if (answer) correct += 1;
    }
  }
  return Math.round((correct / checks.length) * 10000) / 100;
}

export async function recordLessonCompletion(userId: string, lessonId: string, score: number | null) {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("lesson_progress")
    .select("best_score, completed_at")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  const now = new Date().toISOString();
  const previous = existing?.best_score == null ? null : Number(existing.best_score);
  const best = score == null ? previous : Math.max(previous ?? 0, score);

  const { error } = await admin.from("lesson_progress").upsert(
    {
      user_id: userId,
      lesson_id: lessonId,
      status: "completed",
      last_viewed_at: now,
      completed_at: existing?.completed_at ?? now,
      best_score: best,
    },
    { onConflict: "user_id,lesson_id" },
  );
  return !error;
}

/**
 * Unit mastery: mastered = every lesson completed with an average best score of at least 80%.
 */
export async function refreshUnitMastery(userId: string, lessonId: string) {
  const admin = createAdminClient();
  const { data: lesson } = await admin.from("lessons").select("unit_id").eq("id", lessonId).maybeSingle();
  if (!lesson) return;

  const [{ count: total }, { data: progress }] = await Promise.all([
    admin.from("lessons").select("id", { count: "exact", head: true }).eq("unit_id", lesson.unit_id),
    admin
      .from("lesson_progress")
      .select("status, best_score, lessons!inner(unit_id)")
      .eq("user_id", userId)
      .eq("lessons.unit_id", lesson.unit_id),
  ]);
  if (!total) return;

  const completed = (progress ?? []).filter((p) => p.status === "completed");
  const scores = completed.map((p) => Number(p.best_score ?? 0));
  const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const score = Math.round((completed.length / total) * average * 100) / 100;
  const level = completed.length === total && average >= MASTERY_SCORE ? "mastered" : "learning";

  await admin
    .from("topic_mastery")
    .upsert({ user_id: userId, unit_id: lesson.unit_id, level, score }, { onConflict: "user_id,unit_id" });
}
