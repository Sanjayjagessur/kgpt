"use server";

import { z } from "zod";
import { QUIZ_LENGTH, QuizBankSchema } from "@/lib/revision";
import { RATINGS, schedule } from "@/lib/sm2";
import { isoDay } from "@/lib/streak";
import { createClient } from "@/lib/supabase/server";
import { getMasteryMoment } from "@/server/mastery";
import { refreshMasteryForUnit } from "@/server/progress-core";
import { getFlashcardDeck, getQuizBank, getRevisionUnit, revisionLocale } from "@/server/revision";
import { requireStudent } from "@/server/session";
import { createAdminClient } from "@/server/supabase-admin";

const unitIdSchema = z.uuid();

/** Copies a unit's shared deck into the student's own flashcards, due today. Safe to repeat. */
export async function addUnitFlashcards(unitId: string) {
  if (!unitIdSchema.safeParse(unitId).success) return { ok: false as const };
  const student = await requireStudent();
  const unit = await getRevisionUnit(student, unitId);
  if (!unit) return { ok: false as const };

  const deck = await getFlashcardDeck(unitId, revisionLocale(student, unit.subject_id));
  if (!deck) return { ok: false as const };

  const today = isoDay(new Date());
  const supabase = await createClient();
  const { error } = await supabase.from("flashcards").upsert(
    deck.cards.map((card, i) => ({
      user_id: student.id,
      unit_id: unitId,
      deck_position: i + 1,
      front: card.front.slice(0, 1000),
      back: card.back.slice(0, 2000),
      due_on: today,
    })),
    { onConflict: "user_id,unit_id,deck_position", ignoreDuplicates: true },
  );
  return error ? { ok: false as const } : { ok: true as const };
}

const reviewSchema = z.object({ cardId: z.number().int().positive(), rating: z.enum(RATINGS) });

/** Records a review and schedules the card's next due date with SM-2. */
export async function reviewFlashcard(input: z.input<typeof reviewSchema>) {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const };
  const student = await requireStudent();
  const supabase = await createClient();

  const { data: card } = await supabase
    .from("flashcards")
    .select("ease, interval_days, repetitions")
    .eq("id", parsed.data.cardId)
    .eq("user_id", student.id)
    .maybeSingle();
  if (!card) return { ok: false as const };

  const next = schedule(
    { ease: Number(card.ease), intervalDays: card.interval_days, repetitions: card.repetitions },
    parsed.data.rating,
    isoDay(new Date()),
  );
  const { error } = await supabase
    .from("flashcards")
    .update({
      ease: next.ease,
      interval_days: next.intervalDays,
      repetitions: next.repetitions,
      due_on: next.dueOn,
      last_reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.cardId)
    .eq("user_id", student.id);
  return error ? { ok: false as const } : { ok: true as const, dueOn: next.dueOn };
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Starts a quiz with questions drawn at random from the unit's bank. The
 * attempt (with answers) is stored server-side; only questions and options
 * go to the browser.
 */
export async function startQuiz(unitId: string) {
  if (!unitIdSchema.safeParse(unitId).success) return { ok: false as const };
  const student = await requireStudent();
  const unit = await getRevisionUnit(student, unitId);
  if (!unit) return { ok: false as const };
  const bank = await getQuizBank(unitId, revisionLocale(student, unit.subject_id));
  if (!bank) return { ok: false as const };

  const questions = shuffle(bank.questions).slice(0, QUIZ_LENGTH);
  const { data, error } = await createAdminClient()
    .from("quiz_attempts")
    .insert({ user_id: student.id, unit_id: unitId, questions })
    .select("id")
    .single();
  if (error || !data) return { ok: false as const };

  return {
    ok: true as const,
    attemptId: data.id,
    questions: questions.map((q) => ({ question: q.question, options: q.options })),
  };
}

const submitSchema = z.object({
  attemptId: z.number().int().positive(),
  answers: z.array(z.number().int().min(0).max(3).nullable()).max(20),
});

/** Marks a quiz on the server against the stored attempt and saves the score. */
export async function submitQuiz(input: z.input<typeof submitSchema>) {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const };
  const student = await requireStudent();
  const admin = createAdminClient();

  const { data: attempt } = await admin
    .from("quiz_attempts")
    .select("questions, unit_id")
    .eq("id", parsed.data.attemptId)
    .eq("user_id", student.id)
    .is("completed_at", null)
    .maybeSingle();
  const questions = QuizBankSchema.shape.questions.safeParse(attempt?.questions);
  if (!questions.success || questions.data.length !== parsed.data.answers.length) return { ok: false as const };

  const answers = parsed.data.answers;
  const correct = questions.data.filter((q, i) => answers[i] === q.correctOption).length;
  const score = Math.round((correct / questions.data.length) * 10000) / 100;

  // Only an unfinished attempt can be completed, so a score is recorded once.
  const { data: saved } = await admin
    .from("quiz_attempts")
    .update({ answers, score, completed_at: new Date().toISOString() })
    .eq("id", parsed.data.attemptId)
    .eq("user_id", student.id)
    .is("completed_at", null)
    .select("id");
  if (!saved?.length) return { ok: false as const };
  // A good quiz can raise the unit's mastery.
  const unitId = attempt!.unit_id;
  const mastered = (await refreshMasteryForUnit(student.id, unitId))
    ? await getMasteryMoment(student.id, unitId, student.profile.ui_locale)
    : null;

  return {
    ok: true as const,
    score,
    correct,
    mastered,
    results: questions.data.map((q) => ({ correctOption: q.correctOption, explanation: q.explanation })),
  };
}
