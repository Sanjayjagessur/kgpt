import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { BillingPlan, SubscriptionStatus } from "@/lib/supabase/database.types";

/** Paddle signs `${ts}:${rawBody}`. Allow some clock drift; replays are harmless (events apply in order). */
const SIGNATURE_TOLERANCE_S = 300;

/** Checks the `Paddle-Signature` header (`ts=…;h1=…`) against the raw request body. */
export function verifyPaddleSignature(rawBody: string, header: string | null, secret: string, now = Date.now()): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(";").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const ts = Number(parts.ts);
  const h1 = parts.h1;
  if (!Number.isFinite(ts) || !h1 || !/^[0-9a-f]+$/i.test(h1)) return false;
  if (Math.abs(now / 1000 - ts) > SIGNATURE_TOLERANCE_S) return false;

  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`, "utf8").digest();
  const given = Buffer.from(h1, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const SubscriptionEventSchema = z.object({
  event_type: z.string().startsWith("subscription."),
  occurred_at: z.string(),
  data: z.object({
    id: z.string(),
    status: z.enum(["trialing", "active", "past_due", "paused", "canceled"]),
    customer_id: z.string().nullish(),
    custom_data: z.looseObject({ student_id: z.uuid(), consent_id: z.uuid() }),
    billing_cycle: z.object({ interval: z.string() }).nullish(),
    current_billing_period: z.object({ ends_at: z.string() }).nullish(),
    scheduled_change: z.object({ action: z.string(), effective_at: z.string() }).nullish(),
    canceled_at: z.string().nullish(),
  }),
});

export type SubscriptionEvent = {
  studentId: string;
  consentId: string;
  subscriptionId: string;
  customerId: string | null;
  status: SubscriptionStatus;
  plan: BillingPlan | null;
  periodEnd: string | null;
  cancelAt: string | null;
  occurredAt: string;
};

/**
 * Reads a subscription webhook into the row we keep. Returns null for events
 * we don't track (transactions, customers, …) or subscriptions without our
 * custom data (made outside the parent page).
 */
export function parseSubscriptionEvent(payload: unknown): SubscriptionEvent | null {
  const parsed = SubscriptionEventSchema.safeParse(payload);
  if (!parsed.success) return null;
  const { data, occurred_at } = parsed.data;
  const interval = data.billing_cycle?.interval;
  return {
    studentId: data.custom_data.student_id,
    consentId: data.custom_data.consent_id,
    subscriptionId: data.id,
    customerId: data.customer_id ?? null,
    status: data.status,
    plan: interval === "year" ? "yearly" : interval === "month" ? "monthly" : null,
    periodEnd: data.current_billing_period?.ends_at ?? null,
    cancelAt:
      data.scheduled_change?.action === "cancel" ? data.scheduled_change.effective_at : (data.canceled_at ?? null),
    occurredAt: occurred_at,
  };
}

/** Paddle settings for the browser checkout. The client token is public by design. */
export function paddleCheckoutConfig() {
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const monthly = process.env.PADDLE_PRICE_MONTHLY;
  const yearly = process.env.PADDLE_PRICE_YEARLY;
  if (!token || !monthly || !yearly) return null;
  return {
    token,
    environment: process.env.NEXT_PUBLIC_PADDLE_ENV === "production" ? ("production" as const) : ("sandbox" as const),
    prices: { monthly, yearly },
  };
}

export type PaddleCheckoutConfig = NonNullable<ReturnType<typeof paddleCheckoutConfig>>;
