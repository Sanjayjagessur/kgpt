import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { stageForGrade } from "@/config/subjects";
import type { Attachment } from "@/lib/chat";
import type { ChatMode } from "@/lib/supabase/database.types";
import type { createClient } from "@/lib/supabase/server";
import type { Student } from "@/server/session";
import { anthropic } from "./client";
import { MODELS } from "./models";
import { STAGE_NAMES, SUBJECT_NAMES } from "./prompts/names";
import { TITLE_SYSTEM, TUTOR_SYSTEM, tutorContext } from "./prompts/tutor";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Messages of context sent with each reply. Older turns are dropped. */
const CONTEXT_MESSAGES = 30;

export type HistoryMessage = { role: "user" | "assistant"; content: string; attachments: Attachment[] };

/**
 * Builds the Claude request for the next tutor reply. Only the latest message's
 * attachments are sent as files; earlier ones are referred to by name.
 */
export async function buildTutorRequest(input: {
  supabase: Supabase;
  student: Student & { profile: { grade: number } };
  history: HistoryMessage[];
  mode: ChatMode;
  subjectId: string | null;
  /** The latest message's attachments, already loaded (see loadAttachmentBlocks). */
  latestAttachmentBlocks: Anthropic.ContentBlockParam[];
  /** Syllabus extracts for this turn (see syllabusContextBlock), or null. */
  syllabusContext: string | null;
}): Promise<Anthropic.MessageCreateParamsStreaming> {
  const { student, mode, subjectId } = input;
  const recent = input.history.slice(-CONTEXT_MESSAGES);
  // The conversation must start with the student.
  while (recent.length && recent[0].role !== "user") recent.shift();

  const messages: Anthropic.MessageParam[] = [];
  for (const [i, m] of recent.entries()) {
    const isLatest = i === recent.length - 1;
    const blocks: Anthropic.ContentBlockParam[] = [];

    if (isLatest && m.role === "user") blocks.push(...input.latestAttachmentBlocks);
    const note =
      !isLatest && m.attachments.length ? `\n\n[Attached earlier: ${m.attachments.map((a) => a.name).join(", ")}]` : "";
    const text = (m.content + note).trim();
    if (text) blocks.push({ type: "text", text });
    if (!blocks.length) continue;

    // Merge consecutive turns from the same role (e.g. after a failed reply).
    const prev = messages.at(-1);
    if (prev?.role === m.role && Array.isArray(prev.content)) prev.content.push(...blocks);
    else messages.push({ role: m.role, content: blocks });
  }

  // Cache the conversation so far; the next reply re-reads it cheaply.
  const last = messages.at(-1);
  if (last && Array.isArray(last.content) && last.content.length) {
    const block = last.content.at(-1)!;
    if (block.type === "text" || block.type === "image" || block.type === "document") {
      block.cache_control = { type: "ephemeral" };
    }
    // Syllabus extracts go after the cache breakpoint: they change every turn and are
    // not stored, so the cached prefix (system + stored conversation) stays reusable.
    if (last.role === "user" && input.syllabusContext) {
      last.content.push({ type: "text", text: input.syllabusContext });
    }
  }

  return {
    model: MODELS.main,
    max_tokens: 8000,
    stream: true,
    thinking: { type: "adaptive", display: "omitted" },
    output_config: { effort: "medium" },
    system: [
      { type: "text", text: TUTOR_SYSTEM, cache_control: { type: "ephemeral" } },
      {
        type: "text",
        text: tutorContext({
          name: student.profile.display_name,
          grade: student.profile.grade,
          stage: STAGE_NAMES[stageForGrade(student.profile.grade)],
          subjects: student.subjects.map((s) => SUBJECT_NAMES[s] ?? s),
          focusSubject: subjectId ? (SUBJECT_NAMES[subjectId] ?? subjectId) : null,
          mode,
          locale: student.profile.tutor_locale,
        }),
      },
    ],
    messages,
  };
}

/** Loads the student's attachments as Claude content blocks (images and PDFs). */
export async function loadAttachmentBlocks(
  supabase: Supabase,
  userId: string,
  attachments: Attachment[],
): Promise<Anthropic.ContentBlockParam[]> {
  const blocks = await Promise.all(attachments.map((a) => attachmentBlock(supabase, userId, a)));
  return blocks.filter((b): b is Anthropic.ContentBlockParam => b !== null);
}

async function attachmentBlock(
  supabase: Supabase,
  userId: string,
  a: Attachment,
): Promise<Anthropic.ContentBlockParam | null> {
  // Files can only come from the student's own folder (storage RLS enforces this too).
  if (!a.path.startsWith(`${userId}/`)) return null;
  const { data, error } = await supabase.storage.from("attachments").download(a.path);
  if (error || !data) {
    console.error("attachment download failed", error?.message);
    return null;
  }
  const base64 = Buffer.from(await data.arrayBuffer()).toString("base64");
  if (a.type === "application/pdf") {
    return { type: "document", title: a.name, source: { type: "base64", media_type: "application/pdf", data: base64 } };
  }
  return { type: "image", source: { type: "base64", media_type: a.type, data: base64 } };
}

/** A short title for a new chat, from the student's first message. */
export async function generateTitle(firstMessage: string): Promise<string | null> {
  try {
    const response = await anthropic().messages.create({
      model: MODELS.fast,
      max_tokens: 30,
      system: TITLE_SYSTEM,
      messages: [{ role: "user", content: firstMessage.slice(0, 2000) }],
    });
    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const title = text.replace(/^["'“”]+|["'“”.]+$/g, "").trim();
    return title ? title.slice(0, 120) : null;
  } catch (err) {
    console.error("title generation failed", (err as Error).message);
    return null;
  }
}
