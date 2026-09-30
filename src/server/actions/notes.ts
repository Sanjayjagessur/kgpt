"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { SUBJECT_IDS } from "@/config/subjects";
import { createClient } from "@/lib/supabase/server";
import { getStudent } from "@/server/session";

/** Creates an empty note and opens it. */
export async function createNote() {
  const student = await getStudent();
  if (!student) redirect("/sign-in");
  const supabase = await createClient();
  const { data, error } = await supabase.from("notes").insert({ user_id: student.id }).select("id").single();
  if (error || !data) redirect("/notes?error=create");
  redirect(`/notes/${data.id}?new=1`);
}

const noteSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().max(160),
  body: z.string().max(40000),
  subjectId: z.enum(SUBJECT_IDS).nullable(),
});

export async function updateNote(input: z.input<typeof noteSchema>) {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success || !(await getStudent())) return { ok: false as const };
  const { id, title, body, subjectId } = parsed.data;
  const supabase = await createClient();
  // RLS limits the update to the student's own note.
  const { data, error } = await supabase
    .from("notes")
    .update({ title, body, subject_id: subjectId })
    .eq("id", id)
    .select("updated_at")
    .maybeSingle();
  if (error || !data) return { ok: false as const };
  return { ok: true as const, updatedAt: data.updated_at };
}

export async function deleteNote(id: string) {
  if (!z.uuid().safeParse(id).success || !(await getStudent())) return { ok: false as const };
  const supabase = await createClient();
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) return { ok: false as const };
  return { ok: true as const };
}

const bookmarkSchema = z.object({ kind: z.enum(["lesson", "unit"]), refId: z.uuid() });

/** Adds or removes a bookmark on a lesson or unit. Returns the new state. */
export async function toggleBookmark(input: z.input<typeof bookmarkSchema>) {
  const parsed = bookmarkSchema.safeParse(input);
  const student = await getStudent();
  if (!parsed.success || !student) return { ok: false as const };
  const { kind, refId } = parsed.data;
  const supabase = await createClient();

  // Only curriculum items that exist can be bookmarked.
  const { data: target } = await supabase
    .from(kind === "lesson" ? "lessons" : "units")
    .select("id")
    .eq("id", refId)
    .maybeSingle();
  if (!target) return { ok: false as const };

  const { data: existing } = await supabase.from("bookmarks").select("id").eq("kind", kind).eq("ref_id", refId).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("bookmarks").delete().eq("id", existing.id);
    return error ? { ok: false as const } : { ok: true as const, bookmarked: false };
  }
  const { error } = await supabase
    .from("bookmarks")
    .upsert({ user_id: student.id, kind, ref_id: refId }, { onConflict: "user_id,kind,ref_id", ignoreDuplicates: true });
  return error ? { ok: false as const } : { ok: true as const, bookmarked: true };
}

export async function removeBookmark(id: number) {
  if (!z.number().int().positive().safeParse(id).success || !(await getStudent())) return { ok: false as const };
  const supabase = await createClient();
  const { error } = await supabase.from("bookmarks").delete().eq("id", id);
  return { ok: !error };
}
