import "server-only";

import { cache } from "react";
import { isSubjectId, type SubjectId } from "@/config/subjects";
import { contentLocale } from "@/lib/lesson-content";
import {
  ExamFeedbackSchema,
  FlashcardDeckSchema,
  MarkSchemeSchema,
  QuizBankSchema,
  UnitSummarySchema,
  type ExamQuestionView,
  type ReviewCard,
} from "@/lib/revision";
import { localized, type Json, type LocaleCode, type MasteryLevel } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import type { Student } from "@/server/session";

type Enrolled = Student & { profile: { grade: number } };

/** Language of a unit's revision material (same rule as lessons). */
export function revisionLocale(student: Student, subjectId: string) {
  return contentLocale(subjectId, student.profile.ui_locale);
}

/** Cards due on or before `today`, keyed by unit id. Cached per request. */
const getDueByUnit = cache(async (studentId: string, today: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("flashcards")
    .select("unit_id")
    .eq("user_id", studentId)
    .lte("due_on", today)
    .limit(5000);
  const due = new Map<string, number>();
  for (const row of data ?? []) due.set(row.unit_id, (due.get(row.unit_id) ?? 0) + 1);
  return due;
});

export type RevisionSubject = { id: SubjectId; due: number };

/** The student's subjects with the number of flashcards due in each. */
export async function getRevisionSubjects(student: Enrolled, today: string): Promise<RevisionSubject[]> {
  if (student.subjects.length === 0) return [];
  const supabase = await createClient();
  const [{ data: units }, due] = await Promise.all([
    supabase.from("units").select("id, subject_id").eq("grade", student.profile.grade).in("subject_id", student.subjects),
    getDueByUnit(student.id, today),
  ]);
  const bySubject = new Map<SubjectId, number>(student.subjects.map((id) => [id, 0]));
  for (const unit of units ?? []) {
    if (!isSubjectId(unit.subject_id)) continue;
    bySubject.set(unit.subject_id, (bySubject.get(unit.subject_id) ?? 0) + (due.get(unit.id) ?? 0));
  }
  return [...bySubject].map(([id, n]) => ({ id, due: n }));
}

export type RevisionUnit = {
  id: string;
  position: number;
  title: Json;
  summary: Json;
  mastery: MasteryLevel;
  cards: number;
  due: number;
  bestQuiz: number | null;
};

export async function getSubjectRevisionUnits(student: Enrolled, subjectId: SubjectId, today: string): Promise<RevisionUnit[]> {
  const supabase = await createClient();
  const [{ data: units }, { data: mastery }, { data: cards }, { data: quizzes }, due] = await Promise.all([
    supabase
      .from("units")
      .select("id, position, title, summary")
      .eq("subject_id", subjectId)
      .eq("grade", student.profile.grade)
      .order("position"),
    supabase.from("topic_mastery").select("unit_id, level").eq("user_id", student.id),
    supabase.from("flashcards").select("unit_id").eq("user_id", student.id).limit(5000),
    supabase
      .from("quiz_attempts")
      .select("unit_id, score")
      .eq("user_id", student.id)
      .not("completed_at", "is", null)
      .limit(1000),
    getDueByUnit(student.id, today),
  ]);
  const levels = new Map((mastery ?? []).map((m) => [m.unit_id, m.level]));
  const cardCount = new Map<string, number>();
  for (const c of cards ?? []) cardCount.set(c.unit_id, (cardCount.get(c.unit_id) ?? 0) + 1);
  const best = new Map<string, number>();
  for (const q of quizzes ?? []) {
    if (q.score == null) continue;
    best.set(q.unit_id, Math.max(best.get(q.unit_id) ?? 0, Number(q.score)));
  }

  return (units ?? []).map((u) => ({
    ...u,
    mastery: levels.get(u.id) ?? "not_started",
    cards: cardCount.get(u.id) ?? 0,
    due: due.get(u.id) ?? 0,
    bestQuiz: best.get(u.id) ?? null,
  }));
}

/** A unit of the student's grade, or null. Cached per request (the unit layout and page both need it). */
export const getRevisionUnit = cache(async (student: Enrolled, unitId: string) => {
  const supabase = await createClient();
  const { data: unit } = await supabase
    .from("units")
    .select("id, subject_id, grade, position, title, summary")
    .eq("id", unitId)
    .maybeSingle();
  if (!unit || !isSubjectId(unit.subject_id) || unit.grade !== student.profile.grade) return null;
  return { ...unit, subject_id: unit.subject_id as SubjectId };
});

export async function getUnitSummary(unitId: string, locale: LocaleCode) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("unit_summaries")
    .select("content")
    .eq("unit_id", unitId)
    .eq("locale", locale)
    .maybeSingle();
  const parsed = data ? UnitSummarySchema.safeParse(data.content) : null;
  return parsed?.success ? parsed.data : null;
}

export async function getFlashcardDeck(unitId: string, locale: LocaleCode) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("unit_revision_content")
    .select("content")
    .eq("unit_id", unitId)
    .eq("locale", locale)
    .eq("kind", "flashcards")
    .maybeSingle();
  const parsed = data ? FlashcardDeckSchema.safeParse(data.content) : null;
  return parsed?.success ? parsed.data : null;
}

export async function getQuizBank(unitId: string, locale: LocaleCode) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("unit_revision_content")
    .select("content")
    .eq("unit_id", unitId)
    .eq("locale", locale)
    .eq("kind", "quiz")
    .maybeSingle();
  const parsed = data ? QuizBankSchema.safeParse(data.content) : null;
  return parsed?.success ? parsed.data : null;
}

type CardRow = {
  id: number;
  front: string;
  back: string;
  ease: number;
  interval_days: number;
  repetitions: number;
};

const toReviewCard = (c: CardRow): ReviewCard => ({
  id: c.id,
  front: c.front,
  back: c.back,
  ease: Number(c.ease),
  intervalDays: c.interval_days,
  repetitions: c.repetitions,
});

/** Due cards across all of the student's units (the daily queue), oldest first. */
export async function getDueCards(student: Enrolled, today: string, locale: string, limit = 50): Promise<ReviewCard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("flashcards")
    .select("id, front, back, ease, interval_days, repetitions, units!inner(subject_id, grade, title)")
    .eq("user_id", student.id)
    .lte("due_on", today)
    .eq("units.grade", student.profile.grade)
    .in("units.subject_id", student.subjects)
    .order("due_on")
    .order("id")
    .limit(limit);
  return (data ?? []).map((c) => ({
    ...toReviewCard(c),
    source: { subjectId: c.units.subject_id, unitTitle: localized(c.units.title, locale) },
  }));
}

/** The student's cards for one unit, with how many are due. */
export async function getUnitCards(studentId: string, unitId: string, today: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("flashcards")
    .select("id, front, back, ease, interval_days, repetitions, due_on")
    .eq("user_id", studentId)
    .eq("unit_id", unitId)
    .order("due_on")
    .order("id");
  const cards = data ?? [];
  const due = cards.filter((c) => c.due_on <= today);
  return {
    all: cards.map(toReviewCard),
    due: due.map(toReviewCard),
    nextDue: cards.find((c) => c.due_on > today)?.due_on ?? null,
  };
}

/** Number of completed quizzes and the best score for a unit. */
export async function getQuizHistory(studentId: string, unitId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quiz_attempts")
    .select("score")
    .eq("user_id", studentId)
    .eq("unit_id", unitId)
    .not("completed_at", "is", null);
  const scores = (data ?? []).map((q) => Number(q.score ?? 0));
  return { attempts: scores.length, best: scores.length ? Math.max(...scores) : null };
}


/** A unit's exam questions with the student's latest attempt at each. */
export async function getExamQuestions(studentId: string, unitId: string, locale: LocaleCode): Promise<ExamQuestionView[]> {
  const supabase = await createClient();
  const { data: questions } = await supabase
    .from("exam_questions")
    .select("id, position, prompt, marks, mark_scheme, model_answer")
    .eq("unit_id", unitId)
    .eq("locale", locale)
    .order("position");
  if (!questions?.length) return [];

  const { data: attempts } = await supabase
    .from("exam_attempts")
    .select("question_id, answer, awarded_marks, feedback, created_at")
    .eq("user_id", studentId)
    .in(
      "question_id",
      questions.map((q) => q.id),
    )
    .order("created_at", { ascending: false });
  const latest = new Map<number, NonNullable<typeof attempts>[number]>();
  for (const a of attempts ?? []) if (!latest.has(a.question_id)) latest.set(a.question_id, a);

  return questions.map((q) => {
    const a = latest.get(q.id);
    const feedback = a ? ExamFeedbackSchema.safeParse(a.feedback) : null;
    const scheme = MarkSchemeSchema.safeParse(q.mark_scheme);
    return {
      id: q.id,
      position: q.position,
      prompt: q.prompt,
      marks: q.marks,
      markScheme: scheme.success ? scheme.data : [],
      modelAnswer: q.model_answer,
      last:
        a && feedback?.success
          ? { answer: a.answer, awarded: a.awarded_marks, feedback: feedback.data, createdAt: a.created_at }
          : null,
    };
  });
}

type ActivityUnit = { id: string; subject_id: string; grade: number; position: number; title: Json };

export type RevisionActivity = {
  kind: "flashcards" | "quiz" | "exam";
  at: string;
  subjectId: SubjectId;
  unitId: string;
  unitPosition: number;
  unitTitle: Json;
  /** Quiz: percent. Exam: marks awarded out of total. */
  result: { score: number } | { awarded: number; marks: number } | null;
};

/** Recent revision activity in the student's current grade and subjects, newest first. */
export async function getRecentRevision(student: Enrolled, limit = 6): Promise<RevisionActivity[]> {
  const supabase = await createClient();
  const unitCols = "id, subject_id, grade, position, title";
  const [{ data: cards }, { data: quizzes }, { data: exams }] = await Promise.all([
    supabase
      .from("flashcards")
      .select(`last_reviewed_at, units(${unitCols})`)
      .eq("user_id", student.id)
      .not("last_reviewed_at", "is", null)
      .order("last_reviewed_at", { ascending: false })
      .limit(1),
    supabase
      .from("quiz_attempts")
      .select(`score, completed_at, units(${unitCols})`)
      .eq("user_id", student.id)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(limit),
    supabase
      .from("exam_attempts")
      .select(`awarded_marks, created_at, exam_questions(marks, units(${unitCols}))`)
      .eq("user_id", student.id)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const subjects = new Set<string>(student.subjects);
  const items: RevisionActivity[] = [];
  const push = (unit: ActivityUnit | null | undefined, rest: Omit<RevisionActivity, "subjectId" | "unitId" | "unitPosition" | "unitTitle">) => {
    if (!unit || unit.grade !== student.profile.grade || !isSubjectId(unit.subject_id) || !subjects.has(unit.subject_id)) return;
    items.push({ ...rest, subjectId: unit.subject_id, unitId: unit.id, unitPosition: unit.position, unitTitle: unit.title });
  };
  for (const c of cards ?? []) push(c.units, { kind: "flashcards", at: c.last_reviewed_at!, result: null });
  for (const q of quizzes ?? []) push(q.units, { kind: "quiz", at: q.completed_at!, result: { score: Number(q.score ?? 0) } });
  for (const e of exams ?? [])
    push(e.exam_questions?.units, {
      kind: "exam",
      at: e.created_at,
      result: { awarded: e.awarded_marks, marks: e.exam_questions?.marks ?? 0 },
    });
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
