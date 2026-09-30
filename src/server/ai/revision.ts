import "server-only";

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isSubjectId, stageForGrade, SUBJECTS } from "@/config/subjects";
import { LessonContentSchema } from "@/lib/lesson-content";
import {
  ExamSetSchema,
  FlashcardDeckSchema,
  QuizBankSchema,
  UnitSummarySchema,
  type ExamFeedback,
  type MarkScheme,
  type RevisionKind,
} from "@/lib/revision";
import { localized, type Database } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/server/supabase-admin";
import { anthropic } from "./client";
import { MODELS } from "./models";
import { STAGE_NAMES, SUBJECT_NAMES } from "./prompts/names";
import { MARKING_SYSTEM, markingPrompt, REVISION_SYSTEM, revisionPrompt } from "./prompts/revision";

type Locale = "en" | "fr" | "mfe";
type Client = SupabaseClient<Database>;

export class RevisionGenerationError extends Error {}

/** True when the unit already has usable material of this kind in this language. */
export async function isRevisionCached(client: Client, unitId: string, locale: Locale, kind: RevisionKind) {
  if (kind === "summary") {
    const { data } = await client
      .from("unit_summaries")
      .select("content")
      .eq("unit_id", unitId)
      .eq("locale", locale)
      .maybeSingle();
    return !!data && UnitSummarySchema.safeParse(data.content).success;
  }
  if (kind === "exam") {
    const { count } = await client
      .from("exam_questions")
      .select("id", { count: "exact", head: true })
      .eq("unit_id", unitId)
      .eq("locale", locale);
    return (count ?? 0) > 0;
  }
  const { data } = await client
    .from("unit_revision_content")
    .select("content")
    .eq("unit_id", unitId)
    .eq("locale", locale)
    .eq("kind", kind)
    .maybeSingle();
  const schema = kind === "flashcards" ? FlashcardDeckSchema : QuizBankSchema;
  return !!data && schema.safeParse(data.content).success;
}

// De-duplicates concurrent generations of the same material within one server instance.
const inFlight = new Map<string, Promise<void>>();

/**
 * Generates and caches a unit's revision material on first request.
 * Shared by all students: one generation per unit, language and kind.
 */
export function ensureRevisionContent(unitId: string, locale: Locale, kind: RevisionKind) {
  const key = `${unitId}:${locale}:${kind}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const job = generate(unitId, locale, kind).finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

async function unitContext(admin: Client, unitId: string, locale: Locale) {
  const { data: unit } = await admin
    .from("units")
    .select("title, summary, grade, subject_id, lessons(id, position, title, objectives)")
    .eq("id", unitId)
    .maybeSingle();
  if (!unit || !isSubjectId(unit.subject_id) || !SUBJECTS[unit.subject_id].grades.includes(unit.grade)) {
    throw new RevisionGenerationError("unit not found");
  }
  const lessons = [...unit.lessons].sort((a, b) => a.position - b.position);

  // Ground the material in what the lessons actually taught, where they have been written.
  const { data: contents } = await admin
    .from("lesson_content")
    .select("lesson_id, content")
    .in(
      "lesson_id",
      lessons.map((l) => l.id),
    )
    .eq("locale", locale);
  const keyPoints = new Map<string, string[]>();
  for (const row of contents ?? []) {
    const parsed = LessonContentSchema.safeParse(row.content);
    if (parsed.success) keyPoints.set(row.lesson_id, parsed.data.keyPoints);
  }

  return {
    subject: SUBJECT_NAMES[unit.subject_id] ?? unit.subject_id,
    grade: unit.grade,
    stage: STAGE_NAMES[stageForGrade(unit.grade)],
    unitTitle: localized(unit.title, "en"),
    unitSummary: localized(unit.summary, "en"),
    lessons: lessons.map((l) => ({
      title: localized(l.title, "en"),
      objectives: Array.isArray(l.objectives) ? l.objectives.map(String) : [],
      keyPoints: keyPoints.get(l.id) ?? [],
    })),
  };
}

async function ask<T extends z.ZodType>(schema: T, prompt: string): Promise<z.infer<T>> {
  const response = await anthropic().messages.parse({
    model: MODELS.main,
    max_tokens: 16000,
    system: [{ type: "text", text: REVISION_SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "medium", format: zodOutputFormat(schema) },
    messages: [{ role: "user", content: prompt }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new RevisionGenerationError(`generation failed: ${response.stop_reason}`);
  }
  return response.parsed_output as z.infer<T>;
}

async function generate(unitId: string, locale: Locale, kind: RevisionKind) {
  const admin = createAdminClient();
  if (await isRevisionCached(admin, unitId, locale, kind)) return;

  const prompt = revisionPrompt({ kind, locale, ...(await unitContext(admin, unitId, locale)) });
  let error: { message: string } | null = null;

  if (kind === "summary") {
    const content = await ask(UnitSummarySchema, prompt);
    ({ error } = await admin
      .from("unit_summaries")
      .upsert({ unit_id: unitId, locale, content, model: MODELS.main }, { onConflict: "unit_id,locale" }));
  } else if (kind === "flashcards") {
    const deck = await ask(FlashcardDeckSchema, prompt);
    const cards = deck.cards.filter((c) => c.front.trim() && c.back.trim()).slice(0, 50);
    if (cards.length < 4) throw new RevisionGenerationError("too few flashcards");
    ({ error } = await admin
      .from("unit_revision_content")
      .upsert(
        { unit_id: unitId, locale, kind, content: { cards }, model: MODELS.main },
        { onConflict: "unit_id,locale,kind" },
      ));
  } else if (kind === "quiz") {
    const bank = await ask(QuizBankSchema, prompt);
    const questions = bank.questions.filter(
      (q) => q.options.length === 4 && q.correctOption >= 0 && q.correctOption < 4,
    );
    if (questions.length < 4) throw new RevisionGenerationError("too few quiz questions");
    ({ error } = await admin
      .from("unit_revision_content")
      .upsert(
        { unit_id: unitId, locale, kind, content: { questions }, model: MODELS.main },
        { onConflict: "unit_id,locale,kind" },
      ));
  } else {
    const set = await ask(ExamSetSchema, prompt);
    const rows = set.questions
      .map((q) => ({ ...q, markScheme: q.markScheme.filter((p) => p.point.trim() && p.marks > 0) }))
      .filter((q) => q.prompt.trim() && q.markScheme.length > 0)
      .slice(0, 6)
      .map((q, i) => {
        // The question total is always the sum of its mark scheme, capped at 20.
        let remaining = 20;
        const markScheme = q.markScheme
          .map((p) => {
            const marks = Math.max(0, Math.min(p.marks, remaining));
            remaining -= marks;
            return { point: p.point, marks };
          })
          .filter((p) => p.marks > 0);
        return {
          unit_id: unitId,
          locale,
          position: i + 1,
          prompt: q.prompt,
          marks: markScheme.reduce((n, p) => n + p.marks, 0),
          mark_scheme: markScheme,
          model_answer: q.modelAnswer,
        };
      });
    if (rows.length === 0) throw new RevisionGenerationError("no exam questions");
    ({ error } = await admin
      .from("exam_questions")
      .upsert(rows, { onConflict: "unit_id,locale,position", ignoreDuplicates: true }));
  }

  // Pages read from the cache, so unsaved material cannot be shown.
  if (error) throw new RevisionGenerationError(`cache write failed: ${error.message}`);
}

const MarkingSchema = z.object({
  points: z.array(z.object({ awarded: z.number().int(), comment: z.string() })),
  summary: z.string(),
  nextStep: z.string(),
});

/**
 * Marks a practice answer against the mark scheme. Marks per point are
 * clamped on the server, so the total can never exceed the question's marks.
 */
export async function markExamAnswer(input: {
  subjectId: string;
  grade: number;
  question: string;
  markScheme: MarkScheme;
  answer: string;
  locale: Locale;
}): Promise<{ awarded: number; feedback: ExamFeedback }> {
  const response = await anthropic().messages.parse({
    model: MODELS.main,
    max_tokens: 4000,
    system: [{ type: "text", text: MARKING_SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "medium", format: zodOutputFormat(MarkingSchema) },
    messages: [
      {
        role: "user",
        content: markingPrompt({
          subject: SUBJECT_NAMES[input.subjectId] ?? input.subjectId,
          grade: input.grade,
          stage: STAGE_NAMES[stageForGrade(input.grade)],
          question: input.question,
          markScheme: input.markScheme,
          answer: input.answer,
          locale: input.locale,
        }),
      },
    ],
  });
  const out = response.parsed_output;
  if (response.stop_reason === "refusal" || !out) throw new RevisionGenerationError(`marking failed: ${response.stop_reason}`);

  const points = input.markScheme.map((p, i) => ({
    point: p.point,
    marks: p.marks,
    awarded: Math.max(0, Math.min(p.marks, Math.round(out.points[i]?.awarded ?? 0))),
    comment: out.points[i]?.comment ?? "",
  }));
  return {
    awarded: points.reduce((n, p) => n + p.awarded, 0),
    feedback: { points, summary: out.summary, nextStep: out.nextStep },
  };
}
