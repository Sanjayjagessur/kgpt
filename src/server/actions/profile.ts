"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { GRADES, SUBJECT_IDS, SUBJECTS } from "@/config/subjects";
import { siteConfig } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { getStudent } from "@/server/session";

const localeSchema = z.enum(siteConfig.uiLocales);

async function setLocaleCookie(locale: string) {
  (await cookies()).set(siteConfig.localeCookie, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

/** Changes the interface language. Works signed in or out. */
export async function setUiLocale(locale: string) {
  const parsed = localeSchema.safeParse(locale);
  if (!parsed.success) return { ok: false as const };
  await setLocaleCookie(parsed.data);

  const student = await getStudent();
  if (student) {
    const supabase = await createClient();
    await supabase.from("profiles").update({ ui_locale: parsed.data }).eq("id", student.id);
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}

const onboardingSchema = z
  .object({
    displayName: z.string().trim().min(1).max(40),
    grade: z.number().int().refine((g) => GRADES.includes(g)),
    subjects: z.array(z.enum(SUBJECT_IDS)).min(1).max(SUBJECT_IDS.length),
    uiLocale: localeSchema,
    tutorLocale: z.enum(siteConfig.tutorLocales),
  })
  .refine((v) => v.subjects.every((s) => SUBJECTS[s].grades.includes(v.grade)), {
    path: ["subjects"],
  });

export type OnboardingInput = z.input<typeof onboardingSchema>;

export async function completeOnboarding(input: OnboardingInput) {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "save" as const };

  const student = await getStudent();
  if (!student) return { ok: false as const, error: "save" as const };

  const { displayName, grade, subjects, uiLocale, tutorLocale } = parsed.data;
  const supabase = await createClient();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      grade,
      ui_locale: uiLocale,
      tutor_locale: tutorLocale,
      onboarded_at: student.profile.onboarded_at ?? new Date().toISOString(),
    })
    .eq("id", student.id);
  if (profileError) return { ok: false as const, error: "save" as const };

  const { error: deleteError } = await supabase
    .from("student_subjects")
    .delete()
    .eq("user_id", student.id)
    .not("subject_id", "in", `(${subjects.join(",")})`);
  const { error: insertError } = await supabase
    .from("student_subjects")
    .upsert(
      subjects.map((subject_id) => ({ user_id: student.id, subject_id })),
      { onConflict: "user_id,subject_id", ignoreDuplicates: true },
    );
  if (deleteError || insertError) return { ok: false as const, error: "save" as const };

  await setLocaleCookie(uiLocale);
  revalidatePath("/", "layout");
  return { ok: true as const };
}
