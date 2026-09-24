import "server-only";

import { cache } from "react";
import { isSubjectId, type SubjectId } from "@/config/subjects";
import type { Json, LessonStatus, MasteryLevel } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import type { Student } from "@/server/session";

export type SubjectSummary = {
  id: SubjectId;
  totalLessons: number;
  completedLessons: number;
  lastStudiedAt: string | null;
};

type ProgressRow = {
  lesson_id: string;
  status: LessonStatus;
  last_viewed_at: string;
  best_score: number | null;
};

/** All of the student's lesson progress rows, keyed by lesson id. Cached per request. */
const getProgressMap = cache(async (studentId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_progress")
    .select("lesson_id, status, last_viewed_at, best_score")
    .eq("user_id", studentId);
  return new Map((data ?? []).map((row) => [row.lesson_id, row as ProgressRow]));
});

/** Progress per chosen subject for the student's grade. */
export async function getSubjectSummaries(student: Student & { profile: { grade: number } }): Promise<SubjectSummary[]> {
  if (student.subjects.length === 0) return [];
  const supabase = await createClient();
  const [{ data: units }, progress] = await Promise.all([
    supabase
      .from("units")
      .select("subject_id, lessons(id)")
      .eq("grade", student.profile.grade)
      .in("subject_id", student.subjects),
    getProgressMap(student.id),
  ]);

  const bySubject = new Map<SubjectId, SubjectSummary>(
    student.subjects.map((id) => [id, { id, totalLessons: 0, completedLessons: 0, lastStudiedAt: null }]),
  );
  for (const unit of units ?? []) {
    if (!isSubjectId(unit.subject_id)) continue;
    const summary = bySubject.get(unit.subject_id);
    if (!summary) continue;
    for (const lesson of unit.lessons) {
      summary.totalLessons += 1;
      const p = progress.get(lesson.id);
      if (!p) continue;
      if (p.status === "completed") summary.completedLessons += 1;
      if (!summary.lastStudiedAt || p.last_viewed_at > summary.lastStudiedAt) summary.lastStudiedAt = p.last_viewed_at;
    }
  }
  return [...bySubject.values()];
}

export type ContinueLesson = {
  subjectId: SubjectId;
  unitId: string;
  unitTitle: Json;
  unitPosition: number;
  lessonId: string;
  lessonTitle: Json;
  lessonPosition: number;
  status: LessonStatus;
  completedInUnit: number;
  totalInUnit: number;
};

/**
 * The lesson to resume: the most recently opened unfinished lesson, or the
 * lesson after the most recently finished one.
 */
export async function getContinueLesson(
  student: Student & { profile: { grade: number } },
): Promise<ContinueLesson | null> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("lesson_progress")
    .select("lesson_id, status, last_viewed_at, lessons(id, position, unit_id, units(grade, subject_id))")
    .eq("user_id", student.id)
    .order("last_viewed_at", { ascending: false })
    .limit(25);
  // Ignore lessons from another grade or a dropped subject (e.g. after changing grade in settings).
  const subjects = new Set<string>(student.subjects);
  const recent = (rows ?? []).find(
    (r) => r.lessons?.units?.grade === student.profile.grade && subjects.has(r.lessons.units.subject_id),
  );
  if (!recent?.lessons) return null;

  const { data: unit } = await supabase
    .from("units")
    .select("id, subject_id, position, title, lessons(id, position, title)")
    .eq("id", recent.lessons.unit_id)
    .maybeSingle();
  if (!unit || !isSubjectId(unit.subject_id)) return null;

  const progress = await getProgressMap(student.id);
  const lessons = [...unit.lessons].sort((a, b) => a.position - b.position);
  let target = lessons.find((l) => l.id === recent.lesson_id);
  if (recent.status === "completed") {
    target = lessons.find((l) => progress.get(l.id)?.status !== "completed") ?? target;
  }
  if (!target) return null;

  return {
    subjectId: unit.subject_id,
    unitId: unit.id,
    unitTitle: unit.title,
    unitPosition: unit.position,
    lessonId: target.id,
    lessonTitle: target.title,
    lessonPosition: target.position,
    status: progress.get(target.id)?.status ?? "not_started",
    completedInUnit: lessons.filter((l) => progress.get(l.id)?.status === "completed").length,
    totalInUnit: lessons.length,
  };
}

export type UnitSummary = {
  id: string;
  position: number;
  title: Json;
  summary: Json;
  totalLessons: number;
  completedLessons: number;
  mastery: MasteryLevel;
};

export async function getSubjectUnits(studentId: string, subjectId: SubjectId, grade: number): Promise<UnitSummary[]> {
  const supabase = await createClient();
  const [{ data: units }, { data: mastery }, progress] = await Promise.all([
    supabase
      .from("units")
      .select("id, position, title, summary, lessons(id)")
      .eq("subject_id", subjectId)
      .eq("grade", grade)
      .order("position"),
    supabase.from("topic_mastery").select("unit_id, level").eq("user_id", studentId),
    getProgressMap(studentId),
  ]);
  const levels = new Map((mastery ?? []).map((m) => [m.unit_id, m.level]));

  return (units ?? []).map((u) => ({
    id: u.id,
    position: u.position,
    title: u.title,
    summary: u.summary,
    totalLessons: u.lessons.length,
    completedLessons: u.lessons.filter((l) => progress.get(l.id)?.status === "completed").length,
    mastery: levels.get(u.id) ?? "not_started",
  }));
}

export type LessonListItem = {
  id: string;
  position: number;
  title: Json;
  objectives: Json;
  status: LessonStatus;
};

export async function getUnitWithLessons(studentId: string, unitId: string) {
  const supabase = await createClient();
  const [{ data: unit }, progress] = await Promise.all([
    supabase
      .from("units")
      .select("id, subject_id, grade, position, title, summary, lessons(id, position, title, objectives)")
      .eq("id", unitId)
      .maybeSingle(),
    getProgressMap(studentId),
  ]);
  if (!unit || !isSubjectId(unit.subject_id)) return null;

  const lessons: LessonListItem[] = [...unit.lessons]
    .sort((a, b) => a.position - b.position)
    .map((l) => ({ ...l, status: progress.get(l.id)?.status ?? "not_started" }));

  return { ...unit, subject_id: unit.subject_id as SubjectId, lessons };
}

export async function getLessonProgress(studentId: string, lessonId: string) {
  return (await getProgressMap(studentId)).get(lessonId) ?? null;
}
