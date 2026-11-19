import { NextResponse } from "next/server";
import { z } from "zod";
import { MarkSchemeSchema, MAX_EXAM_ANSWER } from "@/lib/revision";
import { createClient } from "@/lib/supabase/server";
import { isBlockingInput, logModeration, moderate } from "@/server/ai/moderation";
import { consumeAiQuota, hasAiAccess, PLAN_REQUIRED } from "@/server/ai/quota";
import { markExamAnswer } from "@/server/ai/revision";
import { revisionLocale } from "@/server/revision";
import { getStudent } from "@/server/session";
import { createAdminClient } from "@/server/supabase-admin";

export const maxDuration = 120;

const BodySchema = z.object({ answer: z.string().trim().min(1).max(MAX_EXAM_ANSWER) });

/**
 * Marks a practice answer against the question's mark scheme. Marks are
 * computed and saved here (service role), never taken from the browser.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/revision/exam/[questionId]/mark">) {
  const { questionId } = await ctx.params;
  const id = z.coerce.number().int().positive().safeParse(questionId);
  if (!id.success) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const student = await getStudent();
  if (!student) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (student.profile.grade == null) return NextResponse.json({ error: "onboarding" }, { status: 403 });

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const supabase = await createClient();
  const { data: question } = await supabase
    .from("exam_questions")
    .select("id, prompt, marks, mark_scheme, units(subject_id, grade)")
    .eq("id", id.data)
    .maybeSingle();
  const scheme = MarkSchemeSchema.safeParse(question?.mark_scheme);
  if (!question?.units || question.units.grade !== student.profile.grade || !scheme.success) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!(await hasAiAccess())) return NextResponse.json(PLAN_REQUIRED, { status: 402 });
  if (!(await consumeAiQuota())) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const answer = body.data.answer;
  try {
    const [{ category }, result] = await Promise.all([
      moderate(answer),
      markExamAnswer({
        subjectId: question.units.subject_id,
        grade: question.units.grade,
        question: question.prompt,
        markScheme: scheme.data,
        answer,
        locale: revisionLocale(student, question.units.subject_id),
      }),
    ]);
    if (isBlockingInput(category)) {
      void logModeration(student.id, category, "input");
      return NextResponse.json({ error: category === "self_harm" ? "support" : "unsafe" }, { status: 422 });
    }

    const { data: attempt, error } = await createAdminClient()
      .from("exam_attempts")
      .insert({
        user_id: student.id,
        question_id: question.id,
        answer,
        awarded_marks: result.awarded,
        feedback: result.feedback,
      })
      .select("created_at")
      .single();
    if (error || !attempt) {
      console.error("exam attempt save failed", error?.message);
      return NextResponse.json({ error: "save_failed" }, { status: 500 });
    }
    return NextResponse.json({ awarded: result.awarded, feedback: result.feedback, createdAt: attempt.created_at });
  } catch (err) {
    console.error("exam marking failed", question.id, (err as Error).message);
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }
}
