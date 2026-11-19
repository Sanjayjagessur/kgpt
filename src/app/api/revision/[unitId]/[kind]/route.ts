import { NextResponse } from "next/server";
import { z } from "zod";
import { REVISION_KINDS } from "@/lib/revision";
import { createClient } from "@/lib/supabase/server";
import { consumeAiQuota, hasAiAccess, PLAN_REQUIRED } from "@/server/ai/quota";
import { ensureRevisionContent, isRevisionCached } from "@/server/ai/revision";
import { revisionLocale } from "@/server/revision";
import { getStudent } from "@/server/session";

// Generation takes 20–90 seconds on first request.
export const maxDuration = 180;

/** Generates (once) and caches a unit's summary, flashcards, quiz or exam questions in the student's language. */
export async function POST(_req: Request, ctx: RouteContext<"/api/revision/[unitId]/[kind]">) {
  const { unitId, kind } = await ctx.params;
  const parsedKind = z.enum(REVISION_KINDS).safeParse(kind);
  if (!z.uuid().safeParse(unitId).success || !parsedKind.success) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const student = await getStudent();
  if (!student) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data: unit } = await supabase.from("units").select("subject_id, grade").eq("id", unitId).maybeSingle();
  if (!unit || unit.grade !== student.profile.grade) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const locale = revisionLocale(student, unit.subject_id);
  if (await isRevisionCached(supabase, unitId, locale, parsedKind.data)) return NextResponse.json({ ok: true });

  if (!(await hasAiAccess())) return NextResponse.json(PLAN_REQUIRED, { status: 402 });
  if (!(await consumeAiQuota())) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  try {
    await ensureRevisionContent(unitId, locale, parsedKind.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("revision generation failed", unitId, kind, (err as Error).message);
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }
}
