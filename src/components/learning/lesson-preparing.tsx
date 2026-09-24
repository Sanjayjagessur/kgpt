"use client";

import { CloudOff, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type State = "working" | "error" | "rate_limited";

const REFRESH_GRACE_MS = 15_000;

/** Shown the first time anyone opens a lesson: asks the server to write it, then refreshes. */
export function LessonPreparing({ lessonId }: { lessonId: string }) {
  const t = useTranslations("learn");
  const tc = useTranslations("common");
  const router = useRouter();
  const [state, setState] = useState<State>("working");
  const started = useRef(false);
  const refreshTimer = useRef<number | undefined>(undefined);

  const run = useCallback(async () => {
    window.clearTimeout(refreshTimer.current);
    setState("working");
    try {
      const res = await fetch(`/api/lessons/${lessonId}/content`, { method: "POST" });
      if (res.status === 429) return setState("rate_limited");
      if (!res.ok) return setState("error");
      router.refresh();
      // A successful refresh replaces this component with the lesson. If we are
      // still here after a while, the lesson could not be loaded: offer a retry.
      refreshTimer.current = window.setTimeout(() => setState("error"), REFRESH_GRACE_MS);
    } catch {
      setState("error");
    }
  }, [lessonId, router]);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      void run();
    }
    return () => window.clearTimeout(refreshTimer.current);
  }, [run]);

  if (state !== "working") {
    return (
      <div role="alert" className="flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center">
        <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <CloudOff className="size-6" aria-hidden="true" />
        </span>
        <p className="text-lg font-bold">{t("preparingError")}</p>
        <p className="mt-1 max-w-[44ch] text-sm text-muted-foreground">
          {state === "rate_limited" ? t("rateLimited") : t("preparingErrorBody")}
        </p>
        <Button className="mt-6" onClick={run}>
          {tc("retry")}
        </Button>
      </div>
    );
  }

  return (
    <div aria-busy="true" className="space-y-6">
      <div role="status" className="flex items-start gap-3 rounded-xl bg-secondary p-4 text-secondary-foreground">
        <Sparkles className="mt-0.5 size-5 shrink-0 animate-pulse" aria-hidden="true" />
        <div>
          <p className="font-bold">{t("preparing")}</p>
          <p className="text-sm opacity-90">{t("preparingBody")}</p>
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-7 w-2/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
