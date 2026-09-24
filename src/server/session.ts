import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { isSubjectId, type SubjectId } from "@/config/subjects";
import type { ProfileRow } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type Student = {
  id: string;
  profile: ProfileRow;
  subjects: SubjectId[];
};

/** The signed-in student, or null. Deduplicated per request. */
export const getStudent = cache(async (): Promise<Student | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const [{ data: profile }, { data: subjects }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("student_subjects").select("subject_id").eq("user_id", userId),
  ]);
  if (!profile) return null;

  return {
    id: userId,
    profile,
    subjects: (subjects ?? []).map((s) => s.subject_id).filter(isSubjectId),
  };
});

/** For pages that need a signed-in student who has finished onboarding. */
export async function requireStudent(): Promise<Student & { profile: { grade: number } }> {
  const student = await getStudent();
  if (!student) redirect("/sign-in");
  if (!student.profile.onboarded_at || student.profile.grade == null) redirect("/onboarding");
  return student as Student & { profile: { grade: number } };
}
