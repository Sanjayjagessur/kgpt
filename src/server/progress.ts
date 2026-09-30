import "server-only";

import { isSubjectId, type SubjectId } from "@/config/subjects";
import { MarkSchemeSchema } from "@/lib/revision";
import { addDays, currentStreak, longestStreak } from "@/lib/streak";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import type { Student } from "@/server/session";

type Enrolled = Student & { profile: { grade: number } };

/** Below these results a unit shows up as a weak area. */
const WEAK_LESSONS = 60;
const WEAK_QUIZ = 60;
const WEAK_EXAM = 50;
/** Cards whose ease has dropped this low have been forgotten several times. */
const HARD_CARD_EASE = 2.1;
const HARD_CARDS = 3;

export type SubjectProgress = {
  id: SubjectId;
  units: number;
  mastered: number;
  learning: number;
  lessons: number;
  completedLessons: number;
};

export type WeakReason =
  | { kind: "lessons"; percent: number }
  | { kind: "quiz"; percent: number }
  | { kind: "exam"; percent: number }
  | { kind: "flashcards"; count: number };

export type WeakArea = {
  unitId: string;
  subjectId: SubjectId;
  position: number;
  title: Json;
  reasons: WeakReason[];
  /** Lowest result among the reasons (0–100); used for ordering. */
  severity: number;
};

export type ProgressOverview = {
  streak: number;
  bestStreak: number;
  /** Seconds studied per day for the last 14 days, oldest first. */
  days: { day: string; seconds: number }[];
  weekSeconds: number;
  totalSeconds: number;
  completedLessons: number;
  masteredUnits: number;
  subjects: SubjectProgress[];
  weak: WeakArea[];
};

export async function getProgressOverview(student: Enrolled, today: string): Promise<ProgressOverview> {
  const supabase = await createClient();
  const [
    { data: studyDays },
    { data: units },
    { data: mastery },
    { data: progress },
    { data: quizzes },
    { data: exams },
    { data: hardCards },
  ] = await Promise.all([
    supabase.from("study_days").select("day, seconds").eq("user_id", student.id).gt("seconds", 0).order("day"),
    supabase
      .from("units")
      .select("id, subject_id, position, title, lessons(id)")
      .eq("grade", student.profile.grade)
      .in("subject_id", student.subjects),
    supabase.from("topic_mastery").select("unit_id, level").eq("user_id", student.id),
    supabase.from("lesson_progress").select("lesson_id, status, best_score").eq("user_id", student.id),
    supabase
      .from("quiz_attempts")
      .select("unit_id, score")
      .eq("user_id", student.id)
      .not("completed_at", "is", null)
      .limit(2000),
    supabase
      .from("exam_attempts")
      .select("question_id, awarded_marks, created_at, exam_questions(unit_id, mark_scheme)")
      .eq("user_id", student.id)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("flashcards")
      .select("unit_id")
      .eq("user_id", student.id)
      .lt("ease", HARD_CARD_EASE)
      .not("last_reviewed_at", "is", null)
      .limit(5000),
  ]);

  // Streaks and time studied.
  const seconds = new Map((studyDays ?? []).map((d) => [d.day, d.seconds]));
  const studied = new Set(seconds.keys());
  const days = Array.from({ length: 14 }, (_, i) => {
    const day = addDays(today, i - 13);
    return { day, seconds: seconds.get(day) ?? 0 };
  });
  const weekSeconds = days.slice(-7).reduce((n, d) => n + d.seconds, 0);
  const totalSeconds = [...seconds.values()].reduce((n, s) => n + s, 0);

  const levels = new Map((mastery ?? []).map((m) => [m.unit_id, m.level]));
  const lessonProgress = new Map((progress ?? []).map((p) => [p.lesson_id, p]));

  const bestQuiz = new Map<string, number>();
  for (const q of quizzes ?? []) {
    if (q.score == null) continue;
    bestQuiz.set(q.unit_id, Math.max(bestQuiz.get(q.unit_id) ?? 0, Number(q.score)));
  }

  // Exam result per unit: latest attempt at each question, as a share of its marks.
  const seenQuestions = new Set<number>();
  const examTotals = new Map<string, { awarded: number; marks: number }>();
  for (const e of exams ?? []) {
    if (seenQuestions.has(e.question_id) || !e.exam_questions) continue;
    seenQuestions.add(e.question_id);
    const scheme = MarkSchemeSchema.safeParse(e.exam_questions.mark_scheme);
    const marks = scheme.success ? scheme.data.reduce((n, p) => n + p.marks, 0) : 0;
    if (!marks) continue;
    const t = examTotals.get(e.exam_questions.unit_id) ?? { awarded: 0, marks: 0 };
    examTotals.set(e.exam_questions.unit_id, { awarded: t.awarded + e.awarded_marks, marks: t.marks + marks });
  }

  const hard = new Map<string, number>();
  for (const c of hardCards ?? []) hard.set(c.unit_id, (hard.get(c.unit_id) ?? 0) + 1);

  const bySubject = new Map<SubjectId, SubjectProgress>(
    student.subjects.map((id) => [id, { id, units: 0, mastered: 0, learning: 0, lessons: 0, completedLessons: 0 }]),
  );
  const weak: WeakArea[] = [];
  let completedLessons = 0;
  let masteredUnits = 0;

  for (const unit of units ?? []) {
    if (!isSubjectId(unit.subject_id)) continue;
    const subject = bySubject.get(unit.subject_id);
    if (!subject) continue;

    const level = levels.get(unit.id) ?? "not_started";
    subject.units += 1;
    if (level === "mastered") {
      subject.mastered += 1;
      masteredUnits += 1;
    } else if (level === "learning") subject.learning += 1;

    const scores: number[] = [];
    for (const lesson of unit.lessons) {
      subject.lessons += 1;
      const p = lessonProgress.get(lesson.id);
      if (p?.status !== "completed") continue;
      subject.completedLessons += 1;
      completedLessons += 1;
      if (p.best_score != null) scores.push(Number(p.best_score));
    }

    const reasons: WeakReason[] = [];
    const lessonAverage = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    if (lessonAverage != null && lessonAverage < WEAK_LESSONS) reasons.push({ kind: "lessons", percent: Math.round(lessonAverage) });
    const quiz = bestQuiz.get(unit.id);
    if (quiz != null && quiz < WEAK_QUIZ) reasons.push({ kind: "quiz", percent: Math.round(quiz) });
    const exam = examTotals.get(unit.id);
    const examPercent = exam ? (exam.awarded / exam.marks) * 100 : null;
    if (examPercent != null && examPercent < WEAK_EXAM) reasons.push({ kind: "exam", percent: Math.round(examPercent) });
    const hardCount = hard.get(unit.id) ?? 0;
    if (hardCount >= HARD_CARDS) reasons.push({ kind: "flashcards", count: hardCount });

    if (reasons.length) {
      const severity = Math.min(...reasons.map((r) => (r.kind === "flashcards" ? 60 : r.percent)));
      weak.push({ unitId: unit.id, subjectId: unit.subject_id, position: unit.position, title: unit.title, reasons, severity });
    }
  }

  return {
    streak: currentStreak(studied, today),
    bestStreak: longestStreak(studied),
    days,
    weekSeconds,
    totalSeconds,
    completedLessons,
    masteredUnits,
    subjects: [...bySubject.values()],
    weak: weak.sort((a, b) => a.severity - b.severity || b.reasons.length - a.reasons.length).slice(0, 6),
  };
}
