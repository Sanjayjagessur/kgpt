import { NextResponse } from "next/server";
import { parseSubscriptionEvent, verifyPaddleSignature } from "@/server/billing/paddle";
import { createAdminClient } from "@/server/supabase-admin";

/**
 * Paddle notification destination. Mirrors subscription events into
 * `subscriptions` (service role). Answers 200 for events we don't track so
 * Paddle doesn't retry them.
 */
export async function POST(req: Request) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("PADDLE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  if (!verifyPaddleSignature(rawBody, req.headers.get("paddle-signature"), secret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const event = parseSubscriptionEvent(payload);
  if (!event) return NextResponse.json({ ok: true, ignored: true });

  const { error } = await createAdminClient().rpc("apply_subscription_event", {
    p_student_id: event.studentId,
    p_consent_id: event.consentId,
    p_subscription_id: event.subscriptionId,
    p_status: event.status,
    p_occurred_at: event.occurredAt,
    p_customer_id: event.customerId ?? undefined,
    p_plan: event.plan ?? undefined,
    p_period_end: event.periodEnd ?? undefined,
    p_cancel_at: event.cancelAt ?? undefined,
  });
  if (error) {
    // Unknown student or consent: retrying won't help, so don't ask Paddle to.
    if (error.code === "23503") {
      console.error("subscription event without consent", event.subscriptionId);
      return NextResponse.json({ ok: true, ignored: true });
    }
    console.error("apply_subscription_event failed", error.message);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
