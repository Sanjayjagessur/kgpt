"use server";

import { z } from "zod";
import type { ChatSummary } from "@/lib/chat";
import { createClient } from "@/lib/supabase/server";
import { parseAttachments } from "@/server/chat";
import { getStudent } from "@/server/session";

const titleSchema = z.string().trim().min(1).max(120);

export async function renameChat(chatId: string, title: string) {
  const id = z.uuid().safeParse(chatId);
  const name = titleSchema.safeParse(title);
  if (!id.success || !name.success || !(await getStudent())) return { ok: false as const };
  const supabase = await createClient();
  const { data, error } = await supabase.from("chats").update({ title: name.data }).eq("id", id.data).select("id");
  return { ok: !error && (data?.length ?? 0) > 0 };
}

/** Deletes a chat, its messages (cascade) and the files attached to it. */
export async function deleteChat(chatId: string) {
  const id = z.uuid().safeParse(chatId);
  if (!id.success || !(await getStudent())) return { ok: false as const };
  const supabase = await createClient();

  const { data: messages } = await supabase.from("chat_messages").select("attachments").eq("chat_id", id.data);
  const paths = (messages ?? []).flatMap((m) => parseAttachments(m.attachments).map((a) => a.path));

  const { data, error } = await supabase.from("chats").delete().eq("id", id.data).select("id");
  if (error || !data?.length) return { ok: false as const };

  if (paths.length) {
    const { error: storageError } = await supabase.storage.from("attachments").remove(paths);
    if (storageError) console.error("attachment cleanup failed", storageError.message);
  }
  return { ok: true as const };
}

/** Finds chats whose title or messages contain the query. */
export async function searchChats(query: string): Promise<ChatSummary[]> {
  const q = z.string().trim().min(2).max(100).safeParse(query);
  if (!q.success || !(await getStudent())) return [];
  // Escape LIKE wildcards and PostgREST filter syntax characters.
  const pattern = `%${q.data.replace(/[%_\\]/g, "\\$&").replace(/[,()"]/g, " ")}%`;
  const supabase = await createClient();

  const [{ data: byTitle }, { data: byMessage }] = await Promise.all([
    supabase
      .from("chats")
      .select("id, title, subject_id, updated_at")
      .ilike("title", pattern)
      .order("updated_at", { ascending: false })
      .limit(30),
    supabase.from("chat_messages").select("chat_id").ilike("content", pattern).order("id", { ascending: false }).limit(100),
  ]);

  const found = new Map((byTitle ?? []).map((c) => [c.id, c]));
  const extraIds = [...new Set((byMessage ?? []).map((m) => m.chat_id))].filter((id) => !found.has(id)).slice(0, 30);
  if (extraIds.length) {
    const { data } = await supabase.from("chats").select("id, title, subject_id, updated_at").in("id", extraIds);
    for (const c of data ?? []) found.set(c.id, c);
  }
  return [...found.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

/** Saves a tutor reply as a note. Saving the same reply twice keeps one note. */
export async function saveMessageToNotes(messageId: number) {
  const id = z.number().int().positive().safeParse(messageId);
  const student = await getStudent();
  if (!id.success || !student) return { ok: false as const };
  const supabase = await createClient();

  const { data: message } = await supabase
    .from("chat_messages")
    .select("id, content, role, chat_id, chats(title, subject_id)")
    .eq("id", id.data)
    .maybeSingle();
  if (!message || message.role !== "assistant" || !message.chats) return { ok: false as const };

  const { data: existing } = await supabase
    .from("notes")
    .select("id")
    .contains("source", { message_id: message.id })
    .limit(1);
  if (existing?.length) return { ok: true as const };

  const { error } = await supabase.from("notes").insert({
    user_id: student.id,
    title: message.chats.title.slice(0, 160),
    body: message.content,
    subject_id: message.chats.subject_id,
    source: { chat_id: message.chat_id, message_id: message.id },
  });
  return { ok: !error };
}
