import "server-only";

import { isSubjectId, type SubjectId } from "@/config/subjects";
import { plainPreview } from "@/lib/plain-text";
import { localized } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type NoteSummary = {
  id: string;
  title: string;
  excerpt: string;
  subjectId: SubjectId | null;
  updatedAt: string;
  fromChat: boolean;
};

/** The student's notes, newest first (RLS limits rows to their own). */
export async function listNotes(): Promise<NoteSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select("id, title, body, subject_id, source, updated_at")
    .order("updated_at", { ascending: false })
    .limit(500);
  return (data ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    excerpt: plainPreview(n.body),
    subjectId: n.subject_id && isSubjectId(n.subject_id) ? n.subject_id : null,
    updatedAt: n.updated_at,
    fromChat: typeof n.source === "object" && n.source !== null && "chat_id" in n.source,
  }));
}

export async function getNote(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select("id, title, body, subject_id, source, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const source = data.source as { chat_id?: unknown } | null;
  return {
    id: data.id,
    title: data.title,
    body: data.body,
    subjectId: data.subject_id && isSubjectId(data.subject_id) ? data.subject_id : null,
    chatId: typeof source?.chat_id === "string" ? source.chat_id : null,
    updatedAt: data.updated_at,
  };
}

export type BookmarkItem = {
  id: number;
  kind: "lesson" | "unit";
  subjectId: SubjectId;
  title: string;
  context: string;
  href: string;
  createdAt: string;
};

/** Bookmarked lessons and units with their current titles, newest first. */
export async function listBookmarks(locale: string, unitLabel: (n: number) => string): Promise<BookmarkItem[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("bookmarks")
    .select("id, kind, ref_id, created_at")
    .in("kind", ["lesson", "unit"])
    .order("created_at", { ascending: false })
    .limit(200);
  if (!rows?.length) return [];

  const lessonIds = rows.filter((r) => r.kind === "lesson").map((r) => r.ref_id);
  const unitIds = rows.filter((r) => r.kind === "unit").map((r) => r.ref_id);
  const [{ data: lessons }, { data: units }] = await Promise.all([
    lessonIds.length
      ? supabase.from("lessons").select("id, title, unit_id, units(subject_id, position, title)").in("id", lessonIds)
      : Promise.resolve({ data: [] }),
    unitIds.length
      ? supabase.from("units").select("id, subject_id, position, title").in("id", unitIds)
      : Promise.resolve({ data: [] }),
  ]);
  const lessonMap = new Map((lessons ?? []).map((l) => [l.id, l]));
  const unitMap = new Map((units ?? []).map((u) => [u.id, u]));

  const items: BookmarkItem[] = [];
  for (const row of rows) {
    if (row.kind === "lesson") {
      const lesson = lessonMap.get(row.ref_id);
      if (!lesson?.units || !isSubjectId(lesson.units.subject_id)) continue;
      items.push({
        id: row.id,
        kind: "lesson",
        subjectId: lesson.units.subject_id,
        title: localized(lesson.title, locale),
        context: `${unitLabel(lesson.units.position)}: ${localized(lesson.units.title, locale)}`,
        href: `/learn/${lesson.units.subject_id}/${lesson.unit_id}/${lesson.id}`,
        createdAt: row.created_at,
      });
    } else {
      const unit = unitMap.get(row.ref_id);
      if (!unit || !isSubjectId(unit.subject_id)) continue;
      items.push({
        id: row.id,
        kind: "unit",
        subjectId: unit.subject_id,
        title: localized(unit.title, locale),
        context: unitLabel(unit.position),
        href: `/learn/${unit.subject_id}/${unit.id}`,
        createdAt: row.created_at,
      });
    }
  }
  return items;
}

export async function isBookmarked(kind: "lesson" | "unit", refId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("bookmarks").select("id").eq("kind", kind).eq("ref_id", refId).maybeSingle();
  return !!data;
}
