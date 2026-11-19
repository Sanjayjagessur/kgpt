import "server-only";

import { isSubjectId, type SubjectId } from "@/config/subjects";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { getContinueLesson, type ContinueLesson } from "@/server/learning";
import type { Student } from "@/server/session";

type Enrolled = Student & { profile: { grade: number } };

export type WeakSpot = {
  unitId: string;
  subjectId: SubjectId;
  unitTitle: Json;
  /** Best quiz score for the unit, if the student has taken one. */
  quiz: { score: number; at: string } | null;
  mastery: number;
};

export type NextExam = { id: string; label: string; date: string; daysLeft: number };

export type TodayPlan = {
  dueCards: number;
  continueLesson: ContinueLesson | null;
  weakSpot: WeakSpot | null;
  nextExam: NextExam | null;
};

function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

/**
 * Everything the Today page needs, from the student's real data only:
 * flashcards due, the lesson to continue, the weakest unit they have started,
 * and their next exam. Any part with no data is null (never invented).
 */
export async function getTodayPlan(student: Enrolled, today: string): Promise<TodayPlan> {
  const supabase = await createClient();
  const subjects = new Set<string>(student.subjects);

  const [{ count: dueCards }, continueLesson, { data: mastery }, { data: exams }] = await Promise.all([
    supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", student.id).lte("due_on", today),
    getContinueLesson(student),
    supabase
      .from("topic_mastery")
      .select("unit_id, score, level, units!inner(id, subject_id, grade, title)")
      .eq("user_id", student.id)
      .eq("level", "learning")
      .eq("units.grade", student.profile.grade)
      .order("score", { ascending: true })
      .limit(10),
    supabase
      .from("student_exams")
      .select("id, label, exam_date")
      .eq("user_id", student.id)
      .gte("exam_date", today)
      .order("exam_date", { ascending: true })
      .limit(1),
  ]);

  // Weakest started unit in a current subject, other than the one already in "continue".
  const candidate = (mastery ?? []).find(
    (m) => m.units && subjects.has(m.units.subject_id) && m.unit_id !== continueLesson?.unitId,
  );
  let weakSpot: WeakSpot | null = null;
  if (candidate?.units && isSubjectId(candidate.units.subject_id)) {
    const { data: quizzes } = await supabase
      .from("quiz_attempts")
      .select("score, completed_at")
      .eq("user_id", student.id)
      .eq("unit_id", candidate.unit_id)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1);
    const quiz = quizzes?.[0];
    weakSpot = {
      unitId: candidate.unit_id,
      subjectId: candidate.units.subject_id,
      unitTitle: candidate.units.title,
      quiz: quiz?.completed_at && quiz.score != null ? { score: Number(quiz.score), at: quiz.completed_at } : null,
      mastery: Number(candidate.score ?? 0),
    };
  }

  const exam = exams?.[0];
  return {
    dueCards: dueCards ?? 0,
    continueLesson,
    weakSpot,
    nextExam: exam ? { id: exam.id, label: exam.label, date: exam.exam_date, daysLeft: daysBetween(today, exam.exam_date) } : null,
  };
}
