import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { SUBJECT_NAMES } from "./prompts/names";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type SyllabusExtract = {
  documentTitle: string;
  subjectId: string;
  gradeMin: number;
  gradeMax: number;
  source: "official" | "teacher" | "generated";
  heading: string;
  content: string;
};

/** Longest query sent to search; long homework pastes only need their opening. */
const MAX_QUERY_CHARS = 400;
/** Total characters of extracts added to one tutor turn (about 1,500 tokens). */
const MAX_CONTEXT_CHARS = 6000;

/**
 * One keyword search over the syllabus for the student's message.
 * Never throws and never blocks the tutor: on any problem it returns [].
 */
export async function searchSyllabus(input: {
  supabase: Supabase;
  query: string;
  grade: number;
  locale: "en" | "fr" | "mfe";
  subjects: string[];
  limit?: number;
}): Promise<SyllabusExtract[]> {
  const query = input.query.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_CHARS);
  if (query.length < 3 || !input.subjects.length) return [];
  try {
    const { data, error } = await input.supabase.rpc("search_syllabus", {
      p_query: query,
      p_grade: input.grade,
      p_locale: input.locale,
      p_subjects: input.subjects,
      p_limit: input.limit ?? 4,
    });
    if (error) {
      console.error("search_syllabus failed", error.message);
      return [];
    }
    return (data ?? []).map((r) => ({
      documentTitle: r.document_title,
      subjectId: r.subject_id,
      gradeMin: r.grade_min,
      gradeMax: r.grade_max,
      source: r.source,
      heading: r.heading,
      content: r.content,
    }));
  } catch (err) {
    console.error("search_syllabus threw", (err as Error).message);
    return [];
  }
}

/**
 * Formats extracts as a context block for the latest student turn.
 * The tutor is told how to use it in TUTOR_SYSTEM; students never see this text.
 */
export function syllabusContextBlock(extracts: SyllabusExtract[]): string | null {
  if (!extracts.length) return null;
  let budget = MAX_CONTEXT_CHARS;
  const parts: string[] = [];
  for (const e of extracts) {
    if (budget <= 200) break;
    const grades = e.gradeMin === e.gradeMax ? `Grade ${e.gradeMin}` : `Grades ${e.gradeMin}–${e.gradeMax}`;
    const label = `${SUBJECT_NAMES[e.subjectId] ?? e.subjectId}, ${grades}${e.heading ? ` — ${e.heading}` : ""}`;
    const body = e.content.slice(0, budget);
    budget -= body.length;
    parts.push(`<extract source="${e.source}" from="${escapeAttr(e.documentTitle)}">\n${label}\n${body}\n</extract>`);
  }
  return `<syllabus_context>\n${parts.join("\n")}\n</syllabus_context>`;
}

function escapeAttr(s: string) {
  return s.replace(/["<>]/g, "");
}
