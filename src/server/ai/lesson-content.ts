import "server-only";

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { isSubjectId, stageForGrade, SUBJECTS } from "@/config/subjects";
import { LessonContentSchema, type LessonContent } from "@/lib/lesson-content";
import { localized } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/server/supabase-admin";
import { anthropic } from "./client";
import { MODELS } from "./models";
import { LESSON_SYSTEM, lessonPrompt } from "./prompts/lesson";

/** English subject names for prompts (UI names come from messages). */
const SUBJECT_NAMES: Record<string, string> = {
  "art-design": "Art and Design",
  biology: "Biology",
  business: "Business and Entrepreneurship",
  chemistry: "Chemistry",
  "design-technology": "Design and Technology",
  drama: "Drama",
  english: "English",
  "english-literature": "English Literature",
  "food-textiles": "Food and Textiles",
  french: "French",
  "french-literature": "French Literature",
  ict: "ICT",
  "kreol-morisien": "Kreol Morisien",
  "life-skills": "Life Skills",
  mathematics: "Mathematics",
  "physical-education": "Physical Education",
  physics: "Physics",
  "sexuality-education": "Sexuality Education",
  "social-modern-studies": "Social and Modern Studies",
};

const STAGE_NAMES = { ncf: "NCF", sc: "School Certificate", hsc: "Higher School Certificate" } as const;

export class LessonGenerationError extends Error {}

// De-duplicates concurrent generations of the same lesson within one server instance.
const inFlight = new Map<string, Promise<LessonContent>>();

/**
 * Returns cached lesson content, generating and caching it on first request.
 * Shared by all students: one generation per lesson and language.
 */
export function getOrCreateLessonContent(lessonId: string, locale: "en" | "fr" | "mfe") {
  const key = `${lessonId}:${locale}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const job = generate(lessonId, locale).finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

async function generate(lessonId: string, locale: "en" | "fr" | "mfe"): Promise<LessonContent> {
  const admin = createAdminClient();

  const { data: cached } = await admin
    .from("lesson_content")
    .select("content")
    .eq("lesson_id", lessonId)
    .eq("locale", locale)
    .maybeSingle();
  if (cached) {
    const parsed = LessonContentSchema.safeParse(cached.content);
    if (parsed.success) return parsed.data;
  }

  const { data: lesson } = await admin
    .from("lessons")
    .select("title, objectives, units(title, grade, subject_id)")
    .eq("id", lessonId)
    .maybeSingle();
  const unit = lesson?.units;
  if (!lesson || !unit || !isSubjectId(unit.subject_id) || !SUBJECTS[unit.subject_id].grades.includes(unit.grade)) {
    throw new LessonGenerationError("lesson not found");
  }

  const response = await anthropic().messages.parse({
    model: MODELS.main,
    max_tokens: 16000,
    system: [{ type: "text", text: LESSON_SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "medium", format: zodOutputFormat(LessonContentSchema) },
    messages: [
      {
        role: "user",
        content: lessonPrompt({
          subject: SUBJECT_NAMES[unit.subject_id] ?? unit.subject_id,
          grade: unit.grade,
          stage: STAGE_NAMES[stageForGrade(unit.grade)],
          unitTitle: localized(unit.title, "en"),
          lessonTitle: localized(lesson.title, "en"),
          objectives: Array.isArray(lesson.objectives) ? lesson.objectives.map(String) : [],
          locale,
        }),
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new LessonGenerationError(`generation failed: ${response.stop_reason}`);
  }
  const content = response.parsed_output;

  const { error } = await admin
    .from("lesson_content")
    .upsert({ lesson_id: lessonId, locale, content, model: MODELS.main }, { onConflict: "lesson_id,locale" });
  // The lesson page reads from the cache, so an unsaved lesson cannot be shown.
  if (error) throw new LessonGenerationError(`cache write failed: ${error.message}`);

  return content;
}
