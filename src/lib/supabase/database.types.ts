/**
 * App-facing database types. `generated.types.ts` is produced by
 * `npx supabase gen types typescript --linked > src/lib/supabase/generated.types.ts`;
 * regenerate it after every migration.
 */
import type { Database, Json } from "./generated.types";

export type { Database, Json };

type PublicTables = Database["public"]["Tables"];
export type Row<T extends keyof PublicTables> = PublicTables[T]["Row"];
type Enums = Database["public"]["Enums"];

export type LocaleCode = Enums["locale_code"];
export type LessonStatus = Enums["lesson_status"];
export type MasteryLevel = Enums["mastery_level"];
export type ChatMode = Enums["chat_mode"];
export type ChatRole = Enums["chat_role"];
export type BookmarkKind = Enums["bookmark_kind"];
export type SubscriptionStatus = Enums["subscription_status"];
export type BillingPlan = Enums["billing_plan"];

export type ProfileRow = Row<"profiles">;
export type UnitRow = Row<"units">;
export type LessonRow = Row<"lessons">;
export type ChatRow = Row<"chats">;
export type ChatMessageRow = Row<"chat_messages">;
export type NoteRow = Row<"notes">;
export type FlashcardRow = Row<"flashcards">;
export type ExamQuestionRow = Row<"exam_questions">;
export type SubscriptionRow = Row<"subscriptions">;

/** Localised text stored as jsonb: {"en": "...", "fr": "...", "mfe": "..."}. */
export type Localized = Partial<Record<LocaleCode, string>>;

/** Picks the best available translation: requested locale, then English, then any. */
export function localized(value: Json | null | undefined, locale: string): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return typeof value === "string" ? value : "";
  const map = value as Record<string, unknown>;
  const pick = map[locale] ?? map.en ?? Object.values(map)[0];
  return typeof pick === "string" ? pick : "";
}
