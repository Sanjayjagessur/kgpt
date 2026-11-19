"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isoDay } from "@/lib/streak";
import { createClient } from "@/lib/supabase/server";
import { getStudent } from "@/server/session";

const MAX_DAYS_AHEAD = 730;

const examSchema = z.object({
  label: z.string().trim().min(1).max(80),
  date: z.iso.date(),
});

/** Adds an exam the student is preparing for. Dates must be today or later (within two years). */
export async function addExam(input: z.input<typeof examSchema>) {
  const parsed = examSchema.safeParse(input);
  const student = await getStudent();
  if (!parsed.success || !student) return { ok: false as const, error: "invalid" as const };

  const today = isoDay(new Date());
  const latest = isoDay(new Date(Date.now() + MAX_DAYS_AHEAD * 86_400_000));
  if (parsed.data.date < today || parsed.data.date > latest) return { ok: false as const, error: "date" as const };

  const supabase = await createClient();
  const { error } = await supabase
    .from("student_exams")
    .insert({ user_id: student.id, label: parsed.data.label, exam_date: parsed.data.date });
  if (error) return { ok: false as const, error: "invalid" as const };
  revalidatePath("/learn");
  return { ok: true as const };
}

/** Removes one of the student's exams (RLS limits it to their own rows). */
export async function removeExam(examId: string) {
  const id = z.uuid().safeParse(examId);
  if (!id.success || !(await getStudent())) return { ok: false as const };
  const supabase = await createClient();
  const { error } = await supabase.from("student_exams").delete().eq("id", id.data);
  if (error) return { ok: false as const };
  revalidatePath("/learn");
  return { ok: true as const };
}
