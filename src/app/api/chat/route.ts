import type Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { provisionalTitle, SendMessageSchema, type ChatStreamEvent } from "@/lib/chat";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/server/ai/client";
import { blockingOutputCategory, isBlockingInput, logModeration, moderate, type ModerationCategory } from "@/server/ai/moderation";
import { OutputGuard } from "@/server/ai/output-guard";
import { consumeAiQuota, hasAiAccess, PLAN_REQUIRED } from "@/server/ai/quota";
import { redactPersonalData, stripReservedTags } from "@/lib/safety";
import { searchSyllabus, syllabusContextBlock } from "@/server/ai/syllabus";
import { buildTutorRequest, generateTitle, loadAttachmentBlocks, type HistoryMessage } from "@/server/ai/tutor";
import { parseAttachments } from "@/server/chat";
import { getStudent } from "@/server/session";
import { createAdminClient } from "@/server/supabase-admin";

export const maxDuration = 300;

/**
 * Sends a student message and streams the tutor's reply as NDJSON
 * (one ChatStreamEvent per line).
 *
 * Safety order: contact details are redacted first; the message (with any
 * images) is screened before it is stored; the reply is released to the
 * student paragraph by paragraph, each one screened before it is sent.
 * The student's message is saved with their own session (RLS); the reply is
 * saved server-side with the service role.
 */
export async function POST(req: Request) {
  const student = await getStudent();
  if (!student) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!student.profile.onboarded_at || student.profile.grade == null) {
    return NextResponse.json({ error: "onboarding" }, { status: 403 });
  }
  const grade = student.profile.grade;
  if (!(await hasAiAccess())) return NextResponse.json(PLAN_REQUIRED, { status: 402 });

  const parsed = SendMessageSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { chatId: existingId, subjectId, mode, attachments } = parsed.data;
  if (attachments.some((a) => !a.path.startsWith(`${student.id}/`))) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const supabase = await createClient();
  const t = await getTranslations({ locale: student.profile.tutor_locale, namespace: "chat" });

  // 1. Contact details and ID numbers never reach storage or the AI, and students
  // can't type the platform-only markup the tutor trusts.
  const { text } = redactPersonalData(stripReservedTags(parsed.data.text), t("safety.redacted"));

  // 2. Screen the message and its images while the chat is set up.
  const attachmentBlocksJob = loadAttachmentBlocks(supabase, student.id, attachments);
  const moderationJob = attachmentBlocksJob.then((blocks) =>
    moderate(
      text,
      blocks.filter((b): b is Anthropic.ImageBlockParam => b.type === "image"),
    ),
  );

  // Resolve or create the chat (RLS: only the student's own chats).
  let chat: { id: string; subject_id: string | null };
  const isNew = !existingId;
  if (existingId) {
    const { data } = await supabase.from("chats").select("id, subject_id").eq("id", existingId).maybeSingle();
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    chat = data;
    if (!(await consumeAiQuota())) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
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

  // 3. Store only after screening.
  const input = await moderationJob;
  const blockedInput = isBlockingInput(input.category);
  if (input.category !== "ok") void logModeration(student.id, input.category, "input");

  const { data: userMessage, error: insertError } = await supabase
    .from("chat_messages")
    .insert({ chat_id: chat.id, user_id: student.id, role: "user", content: text, mode, attachments })
    .select("id")
    .single();
  if (insertError || !userMessage) return NextResponse.json({ error: "save_failed" }, { status: 500 });

  // 4. History and one syllabus search, in parallel. Retrieval adds context; it never gates the answer.
  const [{ data: rows }, extracts] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("role, content, attachments")
      .eq("chat_id", chat.id)
      .order("id", { ascending: false })
      .limit(40),
    blockedInput
      ? Promise.resolve([])
      : searchSyllabus({
          supabase,
          query: text,
          grade,
          locale: student.profile.tutor_locale,
          subjects: chat.subject_id ? [chat.subject_id] : student.subjects,
        }),
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
        isNew && text && !blockedInput
          ? generateTitle(text).then(async (title) => {
              if (!title) return;
              await admin.from("chats").update({ title }).eq("id", chat.id);
              send({ t: "title", title });
            })
          : Promise.resolve();

      try {
        if (blockedInput) {
          const reply =
            input.category === "self_harm"
              ? t("safety.support")
              : input.category === "manipulation"
                ? t("safety.manipulation")
                : t("safety.cantHelp");
          send({ t: "delta", text: reply });
          await titleJob;
          send({ t: "done", messageId: await saveReply(reply) });
          return;
        }

        const request = await buildTutorRequest({
          supabase,
          student: { ...student, profile: { ...student.profile, grade } },
          history,
          mode,
          subjectId: chat.subject_id,
          latestAttachmentBlocks: await attachmentBlocksJob,
          syllabusContext: syllabusContextBlock(extracts),
        });

        // 5. Stream through the output guard. Stopping the model when a paragraph
        // fails moderation also saves the cost of the rest of the reply.
        const stop = new AbortController();
        const onClientAbort = () => stop.abort();
        req.signal.addEventListener("abort", onClientAbort);
        const guard = new OutputGuard(
          (chunk) => send({ t: "delta", text: chunk }),
          (category) => {
            void logModeration(student.id, category as ModerationCategory, "output");
            stop.abort();
          },
          blockingOutputCategory,
        );

        let stopReason: string | null = null;
        const usage = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
        try {
          const stream = anthropic().messages.stream(request, { signal: stop.signal });
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              guard.push(event.delta.text);
            } else if (event.type === "message_start") {
              usage.input = event.message.usage.input_tokens;
              usage.cacheRead = event.message.usage.cache_read_input_tokens ?? 0;
              usage.cacheWrite = event.message.usage.cache_creation_input_tokens ?? 0;
            } else if (event.type === "message_delta") {
              stopReason = event.delta.stop_reason;
              usage.output = event.usage.output_tokens;
            }
          }
        } catch (err) {
          // Stopped by the student or by the guard: keep what was safely released.
          if (!stop.signal.aborted) throw err;
        } finally {
          req.signal.removeEventListener("abort", onClientAbort);
        }
        await guard.finish();
        // Counts only, never content: for cost tracking and cache-hit checks.
        console.info(
          "tutor_usage",
          JSON.stringify({ ...usage, extracts: extracts.length, blocked: guard.blocked ?? undefined }),
        );

        let reply = guard.released;
        if (guard.blocked || stopReason === "refusal" || (!reply.trim() && !req.signal.aborted)) {
          reply = t("safety.cantHelp");
          send({ t: "replace", text: reply });
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
