"use client";

import { LockKeyhole } from "lucide-react";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button-link";

/** Shown where an AI feature answered 402: the trial is over and there is no plan. */
export function PlanRequired() {
  const t = useTranslations("billing.required");
  return (
    <div role="alert" className="flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <LockKeyhole className="size-6" aria-hidden="true" />
      </span>
      <p className="text-lg font-bold">{t("title")}</p>
      <p className="mt-1 max-w-[44ch] text-sm text-muted-foreground">{t("body")}</p>
      <ButtonLink href="/settings#plan" className="mt-6">
        {t("action")}
      </ButtonLink>
    </div>
  );
}
