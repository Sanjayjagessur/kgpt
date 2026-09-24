import { NextResponse } from "next/server";
import { z } from "zod";
import { contentLocale, LessonContentSchema } from "@/lib/lesson-content";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateLessonContent } from "@/server/ai/lesson-content";
import { consumeAiQuota } from "@/server/ai/quota";
import { getStudent } from "@/server/session";

// Lesson generation takes 20–60 seconds on first request.
export const maxDuration = 120;

/** Generates (once) and caches the content for a lesson in the student's language. */
export async function POST(_req: Request, ctx: RouteContext<"/api/lessons/[lessonId]/content">) {
  const { lessonId } = await ctx.params;
  if (!z.uuid().safeParse(lessonId).success) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const student = await getStudent();
  if (!student) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, units(subject_id)")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson?.units) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const locale = contentLocale(lesson.units.subject_id, student.profile.ui_locale);

  const { data: cached } = await supabase
    .from("lesson_content")
    .select("content")
    .eq("lesson_id", lessonId)
    .eq("locale", locale)
    .maybeSingle();
  // Only a row that the lesson page can render counts as cached; anything else is regenerated.
  if (cached && LessonContentSchema.safeParse(cached.content).success) return NextResponse.json({ ok: true });

  if (!(await consumeAiQuota())) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  try {
    await getOrCreateLessonContent(lessonId, locale);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("lesson generation failed", lessonId, (err as Error).message);
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }
}
