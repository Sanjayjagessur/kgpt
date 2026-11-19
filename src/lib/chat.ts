import { z } from "zod";
import { SUBJECT_IDS } from "@/config/subjects";

export const CHAT_MODES = ["auto", "explain", "practice", "homework", "writing"] as const;

export const MAX_MESSAGE_CHARS = 8000;
export const MAX_ATTACHMENTS = 3;
/** Matches the `attachments` storage bucket limit. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ATTACHMENT_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
} as const;
export type AttachmentType = keyof typeof ATTACHMENT_TYPES;

export function isAttachmentType(type: string): type is AttachmentType {
  return type in ATTACHMENT_TYPES;
}

/** Stored in chat_messages.attachments. `path` is `<user_id>/<uuid>.<ext>` in the attachments bucket. */
export const AttachmentSchema = z.object({
  path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp|gif|pdf)$/),
  name: z.string().trim().min(1).max(200),
  type: z.enum(Object.keys(ATTACHMENT_TYPES) as [AttachmentType, ...AttachmentType[]]),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const SendMessageSchema = z
  .object({
    chatId: z.uuid().nullable(),
    subjectId: z.enum(SUBJECT_IDS).nullable(),
    mode: z.enum(CHAT_MODES),
    text: z.string().trim().max(MAX_MESSAGE_CHARS),
    attachments: z.array(AttachmentSchema).max(MAX_ATTACHMENTS),
  })
  .refine((m) => m.text.length > 0 || m.attachments.length > 0);
export type SendMessage = z.infer<typeof SendMessageSchema>;

/** One line of the NDJSON stream returned by POST /api/chat. */
export type ChatStreamEvent =
  | { t: "start"; chatId: string; userMessageId: number }
  | { t: "unit"; unit: UnitRef }
  | { t: "delta"; text: string }
  | { t: "replace"; text: string }
  | { t: "title"; title: string }
  | { t: "done"; messageId: number | null }
  | { t: "error"; code: "generation_failed" };

export type ChatSummary = {
  id: string;
  title: string;
  subject_id: string | null;
  updated_at: string;
};

/** The curriculum unit a tutor reply was matched to (shown as a chip linking to it). */
export type UnitRef = { id: string; subjectId: string; grade: number; title: string };

export type UiMessage = {
  /** Database id, or a temporary negative id while sending. */
  id: number;
  role: "user" | "assistant";
  content: string;
  attachments: (Attachment & { url: string | null })[];
  /** Tutor replies only. */
  unit?: UnitRef | null;
};

/** First line of a message, shortened for a provisional chat title. */
export function provisionalTitle(text: string, fallback: string) {
  const line = text.split("\n").find((l) => l.trim())?.trim() ?? "";
  if (!line) return fallback;
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line;
}
