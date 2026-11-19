"use client";

import { CircleAlert, CircleCheck, Lock } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { billingConfig, type Plan } from "@/config/billing";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { recordParentConsent } from "@/server/actions/billing";
import type { PaddleCheckoutConfig } from "@/server/billing/paddle";

/** The parts of Paddle.js v2 we use. */
type PaddleJs = {
  Environment: { set(env: string): void };
  Initialize(options: { token: string; eventCallback?: (event: { name?: string }) => void }): void;
  PricePreview(request: { items: { priceId: string; quantity: number }[] }): Promise<{
    data: { details: { lineItems: { price: { id: string }; formattedTotals: { total: string } }[] } };
  }>;
  Checkout: {
    open(options: {
      items: { priceId: string; quantity: number }[];
      customData: Record<string, string>;
      settings: { displayMode: "overlay"; locale: string; theme: "light" | "dark"; allowLogout: boolean };
    }): void;
  };
};

declare global {
  interface Window {
    Paddle?: PaddleJs;
  }
}

const PADDLE_SRC = "https://cdn.paddle.com/paddle/v2/paddle.js";

let paddlePromise: Promise<PaddleJs> | null = null;

/** Loads and initialises Paddle.js once per page. */
function loadPaddle(config: PaddleCheckoutConfig, onEvent: (name: string) => void): Promise<PaddleJs> {
  paddlePromise ??= new Promise<PaddleJs>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PADDLE_SRC;
    script.async = true;
    script.onload = () => {
      const paddle = window.Paddle;
      if (!paddle) return reject(new Error("Paddle.js missing"));
      if (config.environment === "sandbox") paddle.Environment.set("sandbox");
      paddle.Initialize({ token: config.token, eventCallback: (e) => e.name && onEvent(e.name) });
      resolve(paddle);
    };
    script.onerror = () => {
      paddlePromise = null;
      reject(new Error("Paddle.js failed to load"));
    };
    document.head.appendChild(script);
  });
  return paddlePromise;
}

type ErrorCode = "name" | "agree" | "save" | "checkout" | "invalid" | "expired" | "paid";

export function ParentCheckout({
  token,
  studentName,
  config,
  checkoutLocale,
}: {
  token: string;
  studentName: string;
  config: PaddleCheckoutConfig;
  checkoutLocale: "en" | "fr";
}) {
  const t = useTranslations("billing");
  const tp = useTranslations("billing.parent");
  const [plan, setPlan] = useState<Plan>("yearly");
  const [prices, setPrices] = useState<Partial<Record<Plan, string>> | null>(null);
  const [parentName, setParentName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const ids = { name: useId(), hint: useId(), agree: useId(), error: useId() };
  const doneRef = useRef<HTMLDivElement>(null);
  const app = siteConfig.name;

  useEffect(() => {
    let live = true;
    loadPaddle(config, (name) => {
      if (name === "checkout.completed") setDone(true);
    })
      .then((paddle) =>
        paddle.PricePreview({
          items: billingConfig.plans.map((p) => ({ priceId: config.prices[p], quantity: 1 })),
        }),
      )
      .then((res) => {
        if (!live) return;
        const byId = new Map(res.data.details.lineItems.map((li) => [li.price.id, li.formattedTotals.total]));
        setPrices({ monthly: byId.get(config.prices.monthly), yearly: byId.get(config.prices.yearly) });
      })
      .catch(() => live && setPrices({}));
    return () => {
      live = false;
    };
  }, [config]);

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  function pay(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!parentName.trim()) return setError("name");
    if (!agreed) return setError("agree");
    setError(null);
    startTransition(async () => {
      const res = await recordParentConsent({ token, parentName, agreed: true });
      if (!res.ok) {
        setError(res.error === "invalid" ? "save" : res.error);
        return;
      }
      try {
        const paddle = await loadPaddle(config, (name) => name === "checkout.completed" && setDone(true));
        paddle.Checkout.open({
          items: [{ priceId: config.prices[plan], quantity: 1 }],
          customData: { student_id: res.studentId, consent_id: res.consentId },
          settings: {
            displayMode: "overlay",
            locale: checkoutLocale,
            theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
            allowLogout: false,
          },
        });
      } catch {
        setError("checkout");
      }
    });
  }

  if (done) {
    return (
      <div
        ref={doneRef}
        tabIndex={-1}
        role="status"
        className="mt-10 flex flex-col items-center rounded-xl bg-secondary px-6 py-10 text-center text-secondary-foreground outline-none"
      >
        <CircleCheck className="mb-3 size-10" aria-hidden="true" />
        <p className="text-xl font-extrabold">{tp("successTitle")}</p>
        <p className="mt-2 max-w-[44ch] text-sm opacity-90">{tp("successBody")}</p>
      </div>
    );
  }

  const errorText =
    error === "invalid" || error === "expired"
      ? tp("invalidBody", { app })
      : error === "paid"
        ? tp("paidBody")
        : error
          ? tp(`errors.${error}`)
          : null;
  const link = (href: string) =>
    function DocLink(chunks: React.ReactNode) {
      return (
        <Link href={href} target="_blank" className="font-semibold text-primary underline underline-offset-4">
          {chunks}
        </Link>
      );
    };

  return (
    <form onSubmit={pay} noValidate className="mt-10 space-y-8">
      <fieldset>
        <legend className="text-lg font-bold">{tp("choosePlan")}</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {billingConfig.plans.map((p) => (
            <label
              key={p}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                plan === p && "border-primary bg-primary/5",
              )}
            >
              <input
                type="radio"
                name="plan"
                value={p}
                checked={plan === p}
                onChange={() => setPlan(p)}
                className="mt-1 size-4 accent-primary"
              />
              <span className="flex-1">
                <span className="block font-bold">{t(`plans.${p}`)}</span>
                {prices === null ? (
                  <span className="mt-1 block">
                    <Skeleton className="h-6 w-24" aria-hidden="true" />
                    <span className="sr-only">{tp("priceLoading")}</span>
                  </span>
                ) : prices[p] ? (
                  <span className="mt-1 block text-lg font-extrabold">
                    {prices[p]}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      {p === "monthly" ? tp("perMonth") : tp("perYear")}
                    </span>
                  </span>
                ) : (
                  <span className="mt-1 block text-sm text-muted-foreground">{tp("priceAtCheckout")}</span>
                )}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="text-lg font-bold">{tp("consentTitle")}</legend>
        <div className="space-y-2">
          <Label htmlFor={ids.name}>{tp("nameLabel")}</Label>
          <Input
            id={ids.name}
            value={parentName}
            onChange={(e) => {
              setParentName(e.target.value);
              setError(null);
            }}
            maxLength={80}
            autoComplete="name"
            aria-describedby={ids.hint}
            aria-invalid={error === "name" || undefined}
          />
          <p id={ids.hint} className="text-sm text-muted-foreground">
            {tp("nameHint")}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <input
            id={ids.agree}
            type="checkbox"
            checked={agreed}
            onChange={(e) => {
              setAgreed(e.target.checked);
              setError(null);
            }}
            aria-invalid={error === "agree" || undefined}
            className="mt-1 size-5 shrink-0 accent-primary"
          />
          <label htmlFor={ids.agree} className="text-sm leading-relaxed">
            {studentName
              ? tp.rich("consent", { name: studentName, app, terms: link("/terms"), privacy: link("/privacy") })
              : tp.rich("consentNoName", { app, terms: link("/terms"), privacy: link("/privacy") })}
          </label>
        </div>
      </fieldset>

      <div className="space-y-3">
        {errorText && (
          <p id={ids.error} role="alert" className="flex items-start gap-2 text-sm font-medium text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {errorText}
          </p>
        )}
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          <Lock aria-hidden="true" />
          {pending ? tp("paying") : tp("pay")}
        </Button>
        <p className="text-xs leading-relaxed text-muted-foreground">{tp("payNote")}</p>
      </div>
    </form>
  );
}
