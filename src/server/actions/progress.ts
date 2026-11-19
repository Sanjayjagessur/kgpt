"use server";

import { z } from "zod";
import { contentLocale, LessonContentSchema } from "@/lib/lesson-content";
import { createClient } from "@/lib/supabase/server";
import { recordLessonCompletion, refreshUnitMastery, scoreAnswers } from "@/server/progress-core";
import { getMasteryMoment } from "@/server/mastery";
import { getStudent } from "@/server/session";

const completeSchema = z.object({
  lessonId: z.uuid(),
  answers: z.array(z.union([z.number().int().min(0).max(10), z.boolean(), z.null()])).max(20),
});

/**
 * Marks a lesson complete. The score is computed here from the student's
 * answers against the stored lesson, never taken from the browser.
 */
export async function completeLesson(input: z.input<typeof completeSchema>) {
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const };
  const student = await getStudent();
  if (!student) return { ok: false as const };
  const { lessonId, answers } = parsed.data;

  const supabase = await createClient();
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, units(subject_id, grade)")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson?.units || lesson.units.grade !== student.profile.grade) return { ok: false as const };

  const locale = contentLocale(lesson.units.subject_id, student.profile.ui_locale);
  const { data: row } = await supabase
    .from("lesson_content")
    .select("content")
    .eq("lesson_id", lessonId)
    .eq("locale", locale)
    .maybeSingle();
  const content = row ? LessonContentSchema.safeParse(row.content) : null;
  const score = content?.success ? scoreAnswers(content.data.checks, answers) : null;

  if (!(await recordLessonCompletion(student.id, lessonId, score))) return { ok: false as const };

  // Mastery is recalculated now so a newly mastered unit can be celebrated in the response.
  const masteredUnit = await refreshUnitMastery(student.id, lessonId);
  const mastered = masteredUnit ? await getMasteryMoment(student.id, masteredUnit, student.profile.ui_locale) : null;
  return { ok: true as const, mastered };
}
