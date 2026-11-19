"use client";

import { Copy, Link2, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { billingConfig } from "@/config/billing";
import { createParentInvite } from "@/server/actions/billing";

/** Makes a one-time link for a parent, then offers the share sheet (WhatsApp etc.) or copying it. */
export function ParentLink() {
  const t = useTranslations("billing");
  const [url, setUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputId = useId();
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  function make() {
    startTransition(async () => {
      const res = await createParentInvite();
      if (!res.ok) {
        toast.error(t("linkFailed"));
        return;
      }
      setUrl(res.url);
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("copied"));
    } catch {
      document.getElementById(inputId)?.focus();
    }
  }

  async function share() {
    if (!url) return;
    try {
      await navigator.share({ title: t("shareTitle"), text: t("shareText"), url });
    } catch {
      // Closed the share sheet: nothing to do.
    }
  }

  if (!url) {
    return (
      <Button onClick={make} disabled={pending}>
        <Link2 aria-hidden="true" />
        {pending ? t("making") : t("askParent")}
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <p role="status" className="text-sm font-medium">
        {t("linkReady", { days: billingConfig.inviteDays })}
      </p>
      <label htmlFor={inputId} className="sr-only">
        {t("linkLabel")}
      </label>
      <Input id={inputId} readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-sm" />
      <div className="flex flex-wrap gap-2">
        {canShare && (
          <Button onClick={share}>
            <Share2 aria-hidden="true" />
            {t("share")}
          </Button>
        )}
        <Button variant={canShare ? "outline" : "default"} onClick={copy}>
          <Copy aria-hidden="true" />
          {t("copyLink")}
        </Button>
      </div>
    </div>
  );
}
