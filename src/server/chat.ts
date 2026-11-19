import "server-only";

import { cache } from "react";
import { AttachmentSchema, type Attachment, type ChatSummary, type UiMessage } from "@/lib/chat";
import { getLocale } from "next-intl/server";
import { localized, type Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const HISTORY_LIMIT = 100;

/** Parses the attachments jsonb column, dropping anything malformed. */
export function parseAttachments(value: Json): Attachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((a) => {
    const parsed = AttachmentSchema.safeParse(a);
    return parsed.success ? [parsed.data] : [];
  });
}

/** The student's most recent chats (RLS scopes them to the signed-in student). */
export const listChats = cache(async (): Promise<ChatSummary[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chats")
    .select("id, title, subject_id, updated_at")
    .order("updated_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  return data ?? [];
});

/** A chat with its messages; attachment previews get short-lived signed URLs. */
export async function getChat(chatId: string) {
  const [supabase, locale] = await Promise.all([createClient(), getLocale()]);
  const [{ data: chat }, { data: rows }] = await Promise.all([
    supabase.from("chats").select("id, title, subject_id, mode").eq("id", chatId).maybeSingle(),
    supabase
      .from("chat_messages")
      .select("id, role, content, attachments, units(id, subject_id, grade, title)")
      .eq("chat_id", chatId)
      .order("id", { ascending: true })
      .limit(500),
  ]);
  if (!chat) return null;

  const messages = (rows ?? []).map((m) => ({ ...m, attachments: parseAttachments(m.attachments) }));
  const paths = messages.flatMap((m) => m.attachments.map((a) => a.path));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("attachments").createSignedUrls(paths, 60 * 60);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  return {
    chat,
    messages: messages.map(
      (m): UiMessage => ({
        id: m.id,
        role: m.role,
        content: m.content,
        attachments: m.attachments.map((a) => ({ ...a, url: urls.get(a.path) ?? null })),
        // Units are shown on tutor replies only (the database also enforces this).
        unit:
          m.role === "assistant" && m.units
            ? { id: m.units.id, subjectId: m.units.subject_id, grade: m.units.grade, title: localized(m.units.title, locale) }
            : null,
      }),
    ),
  };
}
