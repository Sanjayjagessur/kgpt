import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { createAdminClient } from "@/server/supabase-admin";
import { anthropic } from "./client";
import { MODELS } from "./models";
import { MODERATION_SYSTEM } from "./prompts/tutor";
import { localSelfHarmScreen } from "@/lib/safety";

const ModerationSchema = z.object({
  category: z.enum(["ok", "self_harm", "sexual", "violence", "hate", "dangerous", "personal_data", "manipulation"]),
});
export type ModerationCategory = z.infer<typeof ModerationSchema>["category"];

/** Categories that stop the tutor from answering a student message normally. */
const BLOCKING_INPUT = new Set<ModerationCategory>(["self_harm", "sexual", "violence", "hate", "dangerous", "manipulation"]);
/** Categories that stop a tutor reply from reaching the student. */
const BLOCKING_OUTPUT = new Set<ModerationCategory>(["sexual", "violence", "hate", "dangerous"]);

/** A stuck safety check must not freeze the tutor: after this, the fallback below runs. */
const MODERATION_TIMEOUT_MS = 6000;

export type ModerationResult = { category: ModerationCategory; failed: boolean };

/**
 * Classifies a message (and any attached images) with the fast model.
 * If the classifier is unavailable, a local keyword screen still catches clear
 * self-harm messages so a student in crisis always gets the support reply.
 */
export async function moderate(text: string, images: Anthropic.ImageBlockParam[] = []): Promise<ModerationResult> {
  if (!text.trim() && !images.length) return { category: "ok", failed: false };
  try {
    const content: Anthropic.ContentBlockParam[] = [
      ...images,
      { type: "text", text: `<text>\n${text.slice(0, 12000)}\n</text>` },
    ];
    const response = await anthropic().messages.parse({
      model: MODELS.fast,
      max_tokens: 64,
      system: [{ type: "text", text: MODERATION_SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { format: zodOutputFormat(ModerationSchema) },
      messages: [{ role: "user", content }],
    }, { timeout: MODERATION_TIMEOUT_MS, maxRetries: 1 });
    return { category: response.parsed_output?.category ?? "ok", failed: false };
  } catch (err) {
    console.error("moderation failed", (err as Error).message);
    return { category: localSelfHarmScreen(text) ?? "ok", failed: true };
  }
}

export function isBlockingInput(category: ModerationCategory) {
  return BLOCKING_INPUT.has(category);
}

export function isBlockingOutput(category: ModerationCategory) {
  return BLOCKING_OUTPUT.has(category);
}

/** Logs the category only; message content is never stored here. */
export async function logModeration(userId: string, category: ModerationCategory, direction: "input" | "output") {
  if (category === "ok") return;
  const { error } = await createAdminClient()
    .from("moderation_events")
    .insert({ user_id: userId, category, direction });
  if (error) console.error("moderation log failed", error.message);
}

/** For OutputGuard: the blocking category of a piece of tutor reply, or null when it may be shown. */
export async function blockingOutputCategory(text: string): Promise<ModerationCategory | null> {
  const { category } = await moderate(text);
  return isBlockingOutput(category) ? category : null;
}
