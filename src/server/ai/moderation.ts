import "server-only";

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { createAdminClient } from "@/server/supabase-admin";
import { anthropic } from "./client";
import { MODELS } from "./models";
import { MODERATION_SYSTEM } from "./prompts/tutor";

const ModerationSchema = z.object({
  category: z.enum(["ok", "self_harm", "sexual", "violence", "hate", "dangerous", "personal_data"]),
});
export type ModerationCategory = z.infer<typeof ModerationSchema>["category"];

/** Categories that stop the tutor from answering normally. */
const BLOCKING = new Set<ModerationCategory>(["self_harm", "sexual", "violence", "hate", "dangerous"]);

/**
 * Classifies a message with the fast model. Fails open ("ok") when the check
 * itself errors: the tutor's own safety instructions still apply.
 */
export async function moderate(text: string): Promise<ModerationCategory> {
  if (!text.trim()) return "ok";
  try {
    const response = await anthropic().messages.parse({
      model: MODELS.fast,
      max_tokens: 64,
      system: [{ type: "text", text: MODERATION_SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { format: zodOutputFormat(ModerationSchema) },
      messages: [{ role: "user", content: `<text>\n${text.slice(0, 12000)}\n</text>` }],
    });
    return response.parsed_output?.category ?? "ok";
  } catch (err) {
    console.error("moderation failed", (err as Error).message);
    return "ok";
  }
}

export function isBlocking(category: ModerationCategory) {
  return BLOCKING.has(category);
}

/** Logs the category only; message content is never stored here. */
export async function logModeration(userId: string, category: ModerationCategory, direction: "input" | "output") {
  if (category === "ok") return;
  const { error } = await createAdminClient()
    .from("moderation_events")
    .insert({ user_id: userId, category, direction });
  if (error) console.error("moderation log failed", error.message);
}
