import "server-only";

import type { MasteryMoment } from "@/lib/mastery";
import { localized } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

/**
 * Data for the "unit mastered" moment: the unit, how the subject's progress
 * moved, and the next unit to study. Read with the student's session (RLS).
 */
export async function getMasteryMoment(userId: string, unitId: string, locale: string): Promise<MasteryMoment | null> {
  const supabase = await createClient();
  const { data: unit } = await supabase
    .from("units")
    .select("id, subject_id, grade, position, title, lessons(id)")
    .eq("id", unitId)
    .maybeSingle();
  if (!unit) return null;

  const [{ data: units }, { data: mastery }] = await Promise.all([
    supabase
      .from("units")
      .select("id, position, title")
      .eq("subject_id", unit.subject_id)
      .eq("grade", unit.grade)
      .order("position", { ascending: true }),
    supabase
      .from("topic_mastery")
      .select("unit_id, level, units!inner(subject_id, grade)")
      .eq("user_id", userId)
      .eq("level", "mastered")
      .eq("units.subject_id", unit.subject_id)
      .eq("units.grade", unit.grade),
  ]);
  const masteredIds = new Set((mastery ?? []).map((m) => m.unit_id));
  masteredIds.add(unit.id);
  const next = (units ?? []).find((u) => u.position > unit.position && !masteredIds.has(u.id)) ??
    (units ?? []).find((u) => !masteredIds.has(u.id));

  return {
    unitId: unit.id,
    subjectId: unit.subject_id,
    grade: unit.grade,
    position: unit.position,
    title: localized(unit.title, locale),
    lessons: unit.lessons.length,
    mastered: masteredIds.size,
    totalUnits: (units ?? []).length,
    nextUnit: next ? { id: next.id, title: localized(next.title, locale) } : null,
  };
}
