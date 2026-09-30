import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { provisionalTitle, SendMessageSchema, type ChatStreamEvent } from "@/lib/chat";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/server/ai/client";
import { isBlocking, logModeration, moderate } from "@/server/ai/moderation";
import { consumeAiQuota } from "@/server/ai/quota";
import { buildTutorRequest, generateTitle, type HistoryMessage } from "@/server/ai/tutor";
import { parseAttachments } from "@/server/chat";
import { getStudent } from "@/server/session";
import { createAdminClient } from "@/server/supabase-admin";

export const maxDuration = 300;

/**
 * Sends a student message and streams the tutor's reply as NDJSON
 * (one ChatStreamEvent per line). The student's message is saved with their
 * own session (RLS); the reply is saved server-side with the service role.
 */
export async function POST(req: Request) {
  const student = await getStudent();
  if (!student) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!student.profile.onboarded_at || student.profile.grade == null) {
    return NextResponse.json({ error: "onboarding" }, { status: 403 });
  }
  const grade = student.profile.grade;

  const parsed = SendMessageSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { chatId: existingId, subjectId, mode, text, attachments } = parsed.data;
  if (attachments.some((a) => !a.path.startsWith(`${student.id}/`))) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const supabase = await createClient();
  const t = await getTranslations({ locale: student.profile.tutor_locale, namespace: "chat" });

  // Resolve or create the chat (RLS: only the student's own chats).
  let chat: { id: string; subject_id: string | null };
  const isNew = !existingId;
  if (existingId) {
    const { data } = await supabase.from("chats").select("id, subject_id").eq("id", existingId).maybeSingle();
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    chat = data;
  } else {
    if (!(await consumeAiQuota())) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    const title = provisionalTitle(text, attachments[0]?.name ?? t("untitled"));
    const { data, error } = await supabase
      .from("chats")
      .insert({ user_id: student.id, title, subject_id: subjectId, mode })
      .select("id, subject_id")
      .single();
    if (error || !data) return NextResponse.json({ error: "save_failed" }, { status: 500 });
    chat = data;
  }
  if (!isNew && (!(await consumeAiQuota()))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { data: userMessage, error: insertError } = await supabase
    .from("chat_messages")
    .insert({ chat_id: chat.id, user_id: student.id, role: "user", content: text, mode, attachments })
    .select("id")
    .single();
  if (insertError || !userMessage) return NextResponse.json({ error: "save_failed" }, { status: 500 });

  const [inputCategory, { data: rows }] = await Promise.all([
    moderate(text),
    supabase
      .from("chat_messages")
      .select("role, content, attachments")
      .eq("chat_id", chat.id)
      .order("id", { ascending: false })
      .limit(40),
  ]);
  const history: HistoryMessage[] = (rows ?? [])
    .reverse()
    .map((m) => ({ role: m.role, content: m.content, attachments: parseAttachments(m.attachments) }));

  const admin = createAdminClient();
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: ChatStreamEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false;
        }
      };

      const saveReply = async (content: string) => {
        const { data, error } = await admin
          .from("chat_messages")
          .insert({ chat_id: chat.id, user_id: student.id, role: "assistant", content, mode })
          .select("id")
          .single();
        if (error) console.error("assistant message save failed", error.message);
        // Touch the chat so it moves to the top of the history.
        await admin.from("chats").update({ mode }).eq("id", chat.id);
        return data?.id ?? null;
      };

      send({ t: "start", chatId: chat.id, userMessageId: userMessage.id });

      const titleJob =
        isNew && text
          ? generateTitle(text).then(async (title) => {
              if (!title) return;
              await admin.from("chats").update({ title }).eq("id", chat.id);
              send({ t: "title", title });
            })
          : Promise.resolve();

      try {
        if (isBlocking(inputCategory)) {
          void logModeration(student.id, inputCategory, "input");
          const reply = inputCategory === "self_harm" ? t("safety.support") : t("safety.cantHelp");
          send({ t: "delta", text: reply });
          await titleJob;
          send({ t: "done", messageId: await saveReply(reply) });
          return;
        }
        if (inputCategory === "personal_data") void logModeration(student.id, inputCategory, "input");

        const request = await buildTutorRequest({
          supabase,
          student: { ...student, profile: { ...student.profile, grade } },
          history,
          mode,
          subjectId: chat.subject_id,
        });

        let reply = "";
        let stopReason: string | null = null;
        try {
          const stream = anthropic().messages.stream(request, { signal: req.signal });
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              reply += event.delta.text;
              send({ t: "delta", text: event.delta.text });
            } else if (event.type === "message_delta") {
              stopReason = event.delta.stop_reason;
            }
          }
        } catch (err) {
          // The student pressed stop or left: keep whatever was written.
          if (!req.signal.aborted) throw err;
        }

        if (stopReason === "refusal" || (!reply.trim() && !req.signal.aborted)) {
          reply = t("safety.cantHelp");
          send({ t: "replace", text: reply });
        } else if (reply.trim() && !req.signal.aborted) {
          const outputCategory = await moderate(reply);
          if (["sexual", "violence", "hate", "dangerous"].includes(outputCategory)) {
            void logModeration(student.id, outputCategory, "output");
            reply = t("safety.cantHelp");
            send({ t: "replace", text: reply });
          }
        }

        await titleJob;
        send({ t: "done", messageId: reply.trim() ? await saveReply(reply) : null });
      } catch (err) {
        console.error("tutor reply failed", (err as Error).message);
        send({ t: "error", code: "generation_failed" });
      } finally {
        if (open) {
          open = false;
          try {
            controller.close();
          } catch {
            // Already closed by the client.
          }
        }
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

