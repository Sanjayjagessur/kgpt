"use client";

import {
  ArrowUp,
  BookOpenText,
  CircleAlert,
  Dumbbell,
  History,
  Lightbulb,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  PenLine,
  Square,
  X,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ReefLine } from "@/components/common/reef-line";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { SubjectId } from "@/config/subjects";
import {
  ATTACHMENT_TYPES,
  CHAT_MODES,
  isAttachmentType,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_MESSAGE_CHARS,
  provisionalTitle,
  type Attachment,
  type ChatStreamEvent,
  type SendMessage,
  type UiMessage,
} from "@/lib/chat";
import type { ChatMode } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { AttachmentPreview, ChatMessage, type FollowUp } from "./chat-message";
import { useChatHistory } from "./chat-history";
import { ChatSidebar } from "./chat-sidebar";
import { EquationInput } from "./equation-input";

type Pending = {
  key: string;
  name: string;
  type: string;
  previewUrl: string | null;
  status: "uploading" | "ready" | "error";
  attachment?: Attachment;
};

type Problem = "rate_limited" | "plan_required" | "failed" | "attachment_type" | "attachment_size" | "upload_failed" | null;

type Props = {
  userId: string;
  chatId: string | null;
  title: string;
  initialMessages: UiMessage[];
  initialMode: ChatMode;
  subjects: SubjectId[];
  initialSubject: SubjectId | null;
};

const ANY_SUBJECT = "any";

export function ChatView(props: Props) {
  const t = useTranslations("chat");
  const ts = useTranslations("subjects");
  const tb = useTranslations("billing.required");
  const history = useChatHistory();

  const [chatId, setChatId] = useState(props.chatId);
  const [title, setTitle] = useState(props.title);
  const [messages, setMessages] = useState(props.initialMessages);
  const [mode, setMode] = useState<ChatMode>(props.initialMode);
  const [subject, setSubject] = useState<SubjectId | null>(props.initialSubject);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [streamingId, setStreamingId] = useState<number | null>(null);
  const [problem, setProblem] = useState<Problem>(null);
  const [status, setStatus] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chatIdRef = useRef(props.chatId);
  const modeId = useId();
  const subjectId = useId();

  const streaming = streamingId !== null;
  const uploading = pending.some((p) => p.status === "uploading");
  const ready = pending.flatMap((p) => (p.status === "ready" && p.attachment ? [p.attachment] : []));
  const canSend = !streaming && !uploading && (text.trim().length > 0 || ready.length > 0);

  // Open existing chats at the latest message.
  useEffect(() => {
    if (props.initialMessages.length) window.scrollTo({ top: document.body.scrollHeight });
  }, [props.initialMessages.length]);

  // Stop any reply in progress when leaving the page.
  useEffect(() => () => abortRef.current?.abort(), []);

  const scrollToEnd = (smooth = false) =>
    requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: smooth ? "smooth" : "auto" }));
  const nearBottom = () => window.innerHeight + window.scrollY >= document.body.scrollHeight - 160;

  const send = useCallback(
    async (override?: string) => {
      const content = (override ?? text).trim();
      const files = override ? [] : ready;
      if (streamingId !== null || uploading || (!content && !files.length)) return;

      const userTemp = -Date.now();
      const replyTemp = userTemp - 1;
      const localAttachments = override
        ? []
        : pending.flatMap((p) =>
            p.status === "ready" && p.attachment ? [{ ...p.attachment, url: p.previewUrl }] : [],
          );
      setMessages((m) => [
        ...m,
        { id: userTemp, role: "user", content, attachments: localAttachments },
        { id: replyTemp, role: "assistant", content: "", attachments: [] },
      ]);
      if (!override) {
        setText("");
        setPending([]);
      }
      setProblem(null);
      setStreamingId(replyTemp);
      setStatus(t("replying"));
      scrollToEnd(true);

      const restore = () => {
        setMessages((m) => m.filter((msg) => msg.id !== userTemp && msg.id !== replyTemp));
        if (!override) setText(content);
      };

      const controller = new AbortController();
      abortRef.current = controller;
      const payload: SendMessage = { chatId, subjectId: subject, mode, text: content, attachments: files };

      let reply = "";
      let frame = 0;
      const paint = () => {
        frame = 0;
        const stick = nearBottom();
        setMessages((m) => m.map((msg) => (msg.id === replyTemp ? { ...msg, content: reply } : msg)));
        if (stick) scrollToEnd();
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          restore();
          setProblem(res.status === 429 ? "rate_limited" : res.status === 402 ? "plan_required" : "failed");
          return;
        }

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        let finalId: number | null = null;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as ChatStreamEvent;
            switch (event.t) {
              case "start":
                setMessages((m) => m.map((msg) => (msg.id === userTemp ? { ...msg, id: event.userMessageId } : msg)));
                if (!chatId) {
                  chatIdRef.current = event.chatId;
                  setChatId(event.chatId);
                  window.history.replaceState(null, "", `/chat/${event.chatId}`);
                  const provisional = provisionalTitle(content, files[0]?.name ?? t("untitled"));
                  setTitle(provisional);
                  history.upsert({ id: event.chatId, title: provisional, subject_id: subject });
                } else {
                  history.upsert({ id: event.chatId });
                }
                break;
              case "delta":
                reply += event.text;
                frame ||= requestAnimationFrame(paint);
                break;
              case "replace":
                reply = event.text;
                frame ||= requestAnimationFrame(paint);
                break;
              case "title":
                setTitle(event.title);
                if (chatIdRef.current) history.upsert({ id: chatIdRef.current, title: event.title });
                break;
              case "done":
                finalId = event.messageId;
                break;
              case "error":
                setProblem("failed");
                break;
            }
          }
        }
        cancelAnimationFrame(frame);
        setMessages((m) =>
          m.flatMap((msg) => {
            if (msg.id !== replyTemp) return [msg];
            if (!reply.trim()) return [];
            return [{ ...msg, content: reply, id: finalId ?? replyTemp }];
          }),
        );
      } catch {
        cancelAnimationFrame(frame);
        if (controller.signal.aborted) {
          // Stopped by the student: keep what was written so far.
          setMessages((m) =>
            m.flatMap((msg) => (msg.id !== replyTemp ? [msg] : reply.trim() ? [{ ...msg, content: reply }] : [])),
          );
        } else {
          setMessages((m) => m.filter((msg) => msg.id !== replyTemp || reply.trim()));
          setProblem("failed");
        }
      } finally {
        abortRef.current = null;
        setStreamingId(null);
        setStatus(t("replyDone"));
      }
    },
    [text, ready, pending, streamingId, uploading, chatId, subject, mode, history, t],
  );

  const followUp = (kind: FollowUp) => void send(t(`followUpPrompt.${kind}`));

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_ATTACHMENTS - pending.length;
    const chosen = Array.from(files).slice(0, Math.max(room, 0));
    const supabase = createClient();
    for (const original of chosen) {
      if (!isAttachmentType(original.type)) {
        setProblem("attachment_type");
        continue;
      }
      const file = original.type.startsWith("image/") && original.type !== "image/gif" ? await shrinkImage(original) : original;
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setProblem("attachment_size");
        continue;
      }
      const type = file.type as keyof typeof ATTACHMENT_TYPES;
      const key = crypto.randomUUID();
      const path = `${props.userId}/${key}.${ATTACHMENT_TYPES[type]}`;
      const previewUrl = type.startsWith("image/") ? URL.createObjectURL(file) : null;
      setPending((p) => [...p, { key, name: original.name, type, previewUrl, status: "uploading" }]);
      const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType: type });
      setPending((p) =>
        p.map((item) =>
          item.key !== key
            ? item
            : error
              ? { ...item, status: "error" }
              : { ...item, status: "ready", attachment: { path, name: original.name.slice(0, 200), type } },
        ),
      );
      if (error) setProblem("upload_failed");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removePending = (key: string) => {
    const item = pending.find((p) => p.key === key);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    if (item?.attachment) void createClient().storage.from("attachments").remove([item.attachment.path]);
    setPending((p) => p.filter((x) => x.key !== key));
  };

  const insertEquation = (latex: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const snippet = `$${latex}$`;
    setText(text.slice(0, start) + snippet + text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  };

  const applySuggestion = (m: ChatMode, prompt: string) => {
    setMode(m);
    setText(prompt);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      el?.focus();
      el?.setSelectionRange(prompt.length, prompt.length);
    });
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const empty = messages.length === 0;
  // Reflects renames made from the history list.
  const shownTitle = history.chats.find((c) => c.id === chatId)?.title || title || t("untitled");

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col sm:min-h-[calc(100dvh-6.5rem)]">
      {/* Top bar: history (phones), title, new chat */}
      <div className="mb-4 flex items-center gap-2">
        <Button variant="outline" size="sm" className="md:hidden" onClick={() => setHistoryOpen(true)}>
          <History aria-hidden="true" />
          {t("history")}
        </Button>
        {!empty && (
          <h1 className="min-w-0 flex-1 truncate font-heading text-lg font-extrabold tracking-[-0.02em] sm:text-xl">
            {shownTitle}
          </h1>
        )}
        {!empty && (
          <Button variant="ghost" size="icon" className="ml-auto md:hidden" onClick={history.startNew} aria-label={t("newChat")}>
            <MessageSquarePlus aria-hidden="true" />
          </Button>
        )}
      </div>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-xs p-4 pt-12">
          <SheetTitle className="sr-only">{t("history")}</SheetTitle>
          <ChatSidebar onNavigate={() => setHistoryOpen(false)} className="h-full" />
        </SheetContent>
      </Sheet>

      <div className="flex-1">
        {empty ? (
          <section aria-labelledby="chat-welcome" className="mx-auto max-w-2xl pt-2 pb-8 sm:pt-8">
            <h1 id="chat-welcome" className="text-3xl font-extrabold tracking-[-0.025em] sm:text-4xl">
              {t("welcomeTitle")}
            </h1>
            <ReefLine className="mt-3 text-primary" />
            <p className="mt-4 max-w-[52ch] text-muted-foreground">{t("welcomeBody")}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <li key={s.mode}>
                  <button
                    type="button"
                    onClick={() => applySuggestion(s.mode, t(`suggestions.${s.mode}.prompt`))}
                    className="flex h-full w-full items-start gap-3 rounded-xl border bg-card p-4 text-left shadow-xs transition-[box-shadow,transform] duration-150 ease-out-soft hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.99]"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                      <s.icon className="size-4" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block font-semibold">{t(`suggestions.${s.mode}.title`)}</span>
                      <span className="block text-sm text-muted-foreground">{t(`suggestions.${s.mode}.body`)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section aria-label={t("conversation")} className="mx-auto max-w-3xl">
            <ol className="space-y-6 pb-6">
              {messages.map((m) => (
                <ChatMessage
                  key={m.id}
                  message={m}
                  streaming={m.id === streamingId}
                  onFollowUp={!streaming && m.id === lastAssistant?.id && m.id > 0 ? followUp : undefined}
                />
              ))}
            </ol>
          </section>
        )}
        <p role="status" className="sr-only">
          {status}
        </p>
      </div>

      {/* Composer, pinned above the phone tab bar */}
      <div className="sticky bottom-0 z-30 -mx-4 bg-background px-4 pt-2 pb-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] sm:-mx-6 sm:px-6 md:pb-6">
        <div className="mx-auto max-w-3xl">
          {problem && (
            <p role="alert" className="mb-2 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">
                {t(`problems.${problem}`)}
                {problem === "plan_required" && (
                  <>
                    {" "}
                    <Link href="/settings#plan" className="font-semibold underline underline-offset-4">
                      {tb("action")}
                    </Link>
                  </>
                )}
              </span>
              <button type="button" onClick={() => setProblem(null)} aria-label={t("dismiss")} className="rounded-sm">
                <X className="size-4" aria-hidden="true" />
              </button>
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="rounded-xl border bg-card shadow-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30"
          >
            {pending.length > 0 && (
              <ul className="flex flex-wrap gap-2 px-3 pt-3" aria-label={t("attachments")}>
                {pending.map((p) => (
                  <li key={p.key} className="relative">
                    <AttachmentPreview name={p.name} type={p.type} url={p.previewUrl} />
                    {p.status === "uploading" && (
                      <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/70">
                        <Loader2 className="size-5 animate-spin" aria-label={t("uploading")} />
                      </span>
                    )}
                    {p.status === "error" && (
                      <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-destructive/15 text-xs font-semibold text-destructive">
                        {t("uploadError")}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removePending(p.key)}
                      aria-label={t("removeAttachment", { name: p.name })}
                      className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border bg-card shadow-xs"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label htmlFor="chat-input" className="sr-only">
              {t("inputLabel")}
            </label>
            <textarea
              id="chat-input"
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
              maxLength={MAX_MESSAGE_CHARS}
              rows={1}
              placeholder={t(`placeholder.${mode}`)}
              className="field-sizing-content block max-h-48 min-h-12 w-full resize-none bg-transparent px-4 pt-3 pb-1 text-base outline-none placeholder:text-muted-foreground"
            />
            <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
              <input
                ref={fileRef}
                type="file"
                accept={Object.keys(ATTACHMENT_TYPES).join(",")}
                multiple
                hidden
                onChange={(e) => void addFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileRef.current?.click()}
                disabled={pending.length >= MAX_ATTACHMENTS || streaming}
                aria-label={t("attach")}
              >
                <Paperclip aria-hidden="true" />
              </Button>
              <EquationInput onInsert={insertEquation} disabled={streaming} />

              <label htmlFor={modeId} className="sr-only">
                {t("modeLabel")}
              </label>
              <Select
                value={mode}
                onValueChange={(v) => v && setMode(v as ChatMode)}
                items={Object.fromEntries(CHAT_MODES.map((m) => [m, t(`modes.${m}.label`)]))}
              >
                <SelectTrigger id={modeId} size="sm" className="border-transparent font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} side="top" className="w-72">
                  {CHAT_MODES.map((m) => (
                    <SelectItem key={m} value={m} className="py-2">
                      <span className="flex flex-col">
                        <span className="font-semibold">{t(`modes.${m}.label`)}</span>
                        <span className="text-xs whitespace-normal text-muted-foreground">{t(`modes.${m}.hint`)}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!chatId && props.subjects.length > 0 && (
                <>
                  <label htmlFor={subjectId} className="sr-only">
                    {t("subjectLabel")}
                  </label>
                  <Select
                    value={subject ?? ANY_SUBJECT}
                    onValueChange={(v) => setSubject(!v || v === ANY_SUBJECT ? null : (v as SubjectId))}
                    items={{ [ANY_SUBJECT]: t("anySubject"), ...Object.fromEntries(props.subjects.map((s) => [s, ts(s)])) }}
                  >
                    <SelectTrigger id={subjectId} size="sm" className="max-w-44 border-transparent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false} side="top">
                      <SelectItem value={ANY_SUBJECT}>{t("anySubject")}</SelectItem>
                      {props.subjects.map((s) => (
                        <SelectItem key={s} value={s}>
                          {ts(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}

              <div className="ml-auto">
                {streaming ? (
                  <Button type="button" variant="secondary" size="icon" onClick={() => abortRef.current?.abort()} aria-label={t("stop")}>
                    <Square className="size-3.5 fill-current" aria-hidden="true" />
                  </Button>
                ) : (
                  <Button type="submit" size="icon" disabled={!canSend} aria-label={t("send")}>
                    <ArrowUp aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>
          </form>
          <p className="mt-2 hidden text-center text-2xs text-muted-foreground sm:block">{t("disclaimer")}</p>
        </div>
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  { mode: "explain", icon: Lightbulb },
  { mode: "practice", icon: Dumbbell },
  { mode: "homework", icon: BookOpenText },
  { mode: "writing", icon: PenLine },
] as const satisfies { mode: ChatMode; icon: unknown }[];

/** Photos from phones are often several MB: resize so they upload fast and fit the AI's image limit. */
async function shrinkImage(file: File): Promise<File> {
  const MAX_SIDE = 2000;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}
