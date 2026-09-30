"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { isSubjectId, type SubjectId } from "@/config/subjects";
import { plainPreview } from "@/lib/plain-text";
import { localized } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { searchChats } from "@/server/actions/chat";
import { getStudent } from "@/server/session";

export type SearchHit = { id: string; href: string; title: string; context: string; subjectId: SubjectId | null };
export type SearchResults = { units: SearchHit[]; lessons: SearchHit[]; notes: SearchHit[]; chats: SearchHit[] };

const EMPTY: SearchResults = { units: [], lessons: [], notes: [], chats: [] };

/**
 * Global search (Ctrl/Cmd+K): units and lessons of the student's grade and
 * subjects, plus their own notes and chats (RLS scopes those to the student).
 */
export async function globalSearch(query: string): Promise<SearchResults> {
  const q = z.string().trim().min(2).max(100).safeParse(query);
  const student = await getStudent();
  if (!q.success || !student || student.profile.grade == null || student.subjects.length === 0) return EMPTY;

  // Escape LIKE wildcards and strip PostgREST filter syntax characters.
  const pattern = `%${q.data.replace(/[%_\\]/g, "\\$&").replace(/[,()"]/g, " ")}%`;
  const locale = await getLocale();
  const titleFilter = [`title->>en.ilike.${pattern}`, locale !== "en" && `title->>${locale}.ilike.${pattern}`]
    .filter(Boolean)
    .join(",");
  const supabase = await createClient();

  const [{ data: units }, { data: lessons }, { data: notes }, chats] = await Promise.all([
    supabase
      .from("units")
      .select("id, subject_id, position, title")
      .eq("grade", student.profile.grade)
      .in("subject_id", student.subjects)
      .or(titleFilter)
      .order("position")
      .limit(6),
    supabase
      .from("lessons")
      .select("id, unit_id, position, title, units!inner(subject_id, grade, position, title)")
      .eq("units.grade", student.profile.grade)
      .in("units.subject_id", student.subjects)
      .or(titleFilter)
      .limit(8),
    supabase
      .from("notes")
      .select("id, title, body, subject_id")
      .or(`title.ilike.${pattern},body.ilike.${pattern}`)
      .order("updated_at", { ascending: false })
      .limit(6),
    searchChats(q.data),
  ]);

  const subject = (id: string | null) => (id && isSubjectId(id) ? id : null);

  return {
    units: (units ?? []).map((u) => ({
      id: u.id,
      href: `/learn/${u.subject_id}/${u.id}`,
      title: localized(u.title, locale),
      context: String(u.position),
      subjectId: subject(u.subject_id),
    })),
    lessons: (lessons ?? []).map((l) => ({
      id: l.id,
      href: `/learn/${l.units.subject_id}/${l.unit_id}/${l.id}`,
      title: localized(l.title, locale),
      context: localized(l.units.title, locale),
      subjectId: subject(l.units.subject_id),
    })),
    notes: (notes ?? []).map((n) => ({
      id: n.id,
      href: `/notes/${n.id}`,
      title: n.title,
      context: plainPreview(n.body, 80),
      subjectId: subject(n.subject_id),
    })),
    chats: chats.slice(0, 6).map((c) => ({
      id: c.id,
      href: `/chat/${c.id}`,
      title: c.title,
      context: "",
      subjectId: subject(c.subject_id),
    })),
  };
}
