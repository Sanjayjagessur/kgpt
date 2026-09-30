import { z } from "zod";

/** Revision material kinds, each generated once per unit and language. */
export const REVISION_KINDS = ["summary", "flashcards", "quiz", "exam"] as const;
export type RevisionKind = (typeof REVISION_KINDS)[number];

/** Shape of an AI-generated unit summary, stored in unit_summaries.content. */
export const UnitSummarySchema = z.object({
  overview: z.string().describe("Markdown: two or three sentences on what the unit is about and why it matters"),
  keyIdeas: z
    .array(z.object({ heading: z.string(), body: z.string().describe("Markdown, short and scannable; bullet lists welcome") }))
    .describe("3 to 6 key ideas covering the whole unit, in teaching order"),
  formulas: z
    .array(
      z.object({
        label: z.string().describe("What it is, e.g. 'Area of a circle'"),
        expression: z.string().describe("Markdown; maths in $...$"),
      }),
    )
    .describe("0 to 8 formulas, rules, dates or facts to memorise; empty if the unit has none"),
  keyTerms: z.array(z.object({ term: z.string(), definition: z.string() })).describe("0 to 10 key terms"),
  commonMistakes: z.array(z.string()).describe("2 to 5 common mistakes, each with how to avoid it (Markdown)"),
  examTips: z.array(z.string()).describe("1 to 4 exam tips for this unit (Markdown)"),
});
export type UnitSummary = z.infer<typeof UnitSummarySchema>;

/** Shared flashcard deck for a unit, stored in unit_revision_content (kind = flashcards). */
export const FlashcardDeckSchema = z.object({
  cards: z
    .array(
      z.object({
        front: z.string().describe("Markdown: one short question or prompt"),
        back: z.string().describe("Markdown: the answer in one to three short lines"),
      }),
    )
    .describe("12 to 16 cards covering the whole unit"),
});
export type FlashcardDeck = z.infer<typeof FlashcardDeckSchema>;

/** Shared quiz question bank for a unit, stored in unit_revision_content (kind = quiz). */
export const QuizBankSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().describe("Markdown"),
        options: z.array(z.string()).describe("Exactly 4 options (Markdown)"),
        correctOption: z.number().int().describe("Index 0 to 3 of the correct option"),
        explanation: z.string().describe("Markdown: why it is right and the mistake behind the most tempting wrong option"),
      }),
    )
    .describe("12 multiple choice questions across the unit, mixed difficulty"),
});
export type QuizBank = z.infer<typeof QuizBankSchema>;
export type QuizQuestion = QuizBank["questions"][number];

/** Questions per quiz attempt, drawn at random from the bank. */
export const QUIZ_LENGTH = 6;

/** Exam-style questions for a unit, stored as exam_questions rows. */
export const ExamSetSchema = z.object({
  questions: z
    .array(
      z.object({
        prompt: z.string().describe("Markdown: the question as it would appear on an exam paper, with any data needed"),
        markScheme: z
          .array(
            z.object({
              point: z.string().describe("One creditworthy point an examiner looks for"),
              marks: z.number().int().describe("Marks for this point, usually 1"),
            }),
          )
          .describe("Mark scheme points; their marks add up to the question total (2 to 10)"),
        modelAnswer: z.string().describe("Markdown: a full-mark answer"),
      }),
    )
    .describe("4 questions from shorter to longer"),
});
export type ExamSet = z.infer<typeof ExamSetSchema>;

export const MarkSchemeSchema = z.array(z.object({ point: z.string(), marks: z.number().int().min(0) }));
export type MarkScheme = z.infer<typeof MarkSchemeSchema>;

/** Marking feedback stored in exam_attempts.feedback and shown to the student. */
export const ExamFeedbackSchema = z.object({
  points: z.array(z.object({ point: z.string(), marks: z.number(), awarded: z.number(), comment: z.string() })),
  summary: z.string(),
  nextStep: z.string(),
});
export type ExamFeedback = z.infer<typeof ExamFeedbackSchema>;

export const MAX_EXAM_ANSWER = 8000;

/** A flashcard as sent to the review session. */
export type ReviewCard = {
  id: number;
  front: string;
  back: string;
  ease: number;
  intervalDays: number;
  repetitions: number;
  /** Shown in the mixed daily queue so students know where a card comes from. */
  source?: { subjectId: string; unitTitle: string };
};

/** Link to a unit's revision tab (the summary is the unit's index page). */
export function revisionHref(subjectId: string, unitId: string, kind: RevisionKind = "summary") {
  const base = `/revision/${subjectId}/${unitId}`;
  return kind === "summary" ? base : `${base}/${kind}`;
}

/** An exam question with the student's latest attempt, as shown on the exam practice page. */
export type ExamQuestionView = {
  id: number;
  position: number;
  prompt: string;
  marks: number;
  markScheme: { point: string; marks: number }[];
  modelAnswer: string;
  last: { answer: string; awarded: number; feedback: ExamFeedback; createdAt: string } | null;
};
