"use client";

import { PartyPopper } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Markdown } from "@/components/common/markdown";
import { ProgressBar } from "@/components/learning/progress-bar";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { subjectStyle, isSubjectId } from "@/config/subjects";
import type { ReviewCard } from "@/lib/revision";
import { RATINGS, schedule, type Rating } from "@/lib/sm2";
import { cn } from "@/lib/utils";
import { reviewFlashcard } from "@/server/actions/revision";

const RATING_STYLE: Record<Rating, string> = {
  again: "border-destructive/40 hover:bg-destructive/10",
  hard: "border-border hover:bg-muted",
  good: "border-primary/50 hover:bg-secondary",
  easy: "border-success/50 hover:bg-success/10",
};

/**
 * Reviews a queue of flashcards. Each rating is saved with SM-2 (unless this
 * is a practice run); "Again" sends the card to the back of the queue.
 */
export function FlashcardSession({
  cards,
  today,
  persist,
  doneHref,
  doneLabel,
}: {
  cards: ReviewCard[];
  today: string;
  /** False for practice runs that should not change the schedule. */
  persist: boolean;
  doneHref: string;
  doneLabel: string;
}) {
  const t = useTranslations("revision");
  const ts = useTranslations("subjects");
  const [queue, setQueue] = useState(cards);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  // Reviews still being saved; the session only offers to leave once they are all stored.
  const [saving, setSaving] = useState(0);
  const revealRef = useRef<HTMLButtonElement>(null);
  const goodRef = useRef<HTMLButtonElement>(null);
  const card = queue[index];
  const done = !card;

  const rate = useCallback(
    (rating: Rating) => {
      if (!card) return;
      const next = schedule(card, rating, today);
      if (persist) {
        setSaving((n) => n + 1);
        reviewFlashcard({ cardId: card.id, rating })
          .then((res) => {
            if (!res.ok) toast.error(t("reviewFailed"));
          })
          .catch(() => toast.error(t("reviewFailed")))
          .finally(() => setSaving((n) => n - 1));
      }
      if (rating === "again") {
        setQueue((q) => [...q, { ...card, ease: next.ease, intervalDays: next.intervalDays, repetitions: next.repetitions }]);
      }
      setReviewed((n) => n + 1);
      setRevealed(false);
      setIndex((i) => i + 1);
    },
    [card, persist, today, t],
  );

  // Move focus with the flow: reveal -> ratings -> next card's reveal button.
  useEffect(() => {
    (revealed ? goodRef : revealRef).current?.focus({ preventScroll: true });
  }, [revealed, index]);

  // Space or Enter shows the answer; 1–4 rate it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (!revealed && e.key === " " && target?.tagName !== "BUTTON") {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        rate(RATINGS[Number(e.key) - 1]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, revealed, rate]);

  if (done) {
    return (
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 26 }}
        role="status"
        className="flex flex-col items-center rounded-xl bg-card px-6 py-10 text-center shadow-sm"
      >
        <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-pollen/20 text-pollen">
          <PartyPopper className="size-7" aria-hidden="true" />
        </span>
        <p className="text-xl font-bold">{t("sessionDone")}</p>
        <p className="mt-1 max-w-[40ch] text-sm text-muted-foreground">
          {persist ? t("sessionDoneBody", { count: reviewed }) : t("practiceDoneBody", { count: reviewed })}
        </p>
        {saving > 0 ? (
          <Button className="mt-6" disabled>
            {t("savingReviews")}
          </Button>
        ) : (
          <ButtonLink href={doneHref} className="mt-6">
            {doneLabel}
          </ButtonLink>
        )}
      </motion.div>
    );
  }

  const source = card.source;
  const intervals = RATINGS.map((r) => schedule(card, r, today).intervalDays);

  return (
    <section aria-label={t("sessionLabel")} className="space-y-4">
      <div className="flex items-center gap-3">
        <ProgressBar
          value={(index / queue.length) * 100}
          label={t("cardOf", { n: index + 1, total: queue.length })}
          className="min-w-0 flex-1"
        />
        <p className="shrink-0 text-sm font-semibold text-muted-foreground tabular-nums" aria-live="polite">
          {t("cardOf", { n: index + 1, total: queue.length })}
        </p>
      </div>

      <div
        style={source && isSubjectId(source.subjectId) ? subjectStyle(source.subjectId) : undefined}
        className="flex min-h-72 flex-col rounded-2xl bg-card p-5 shadow-md sm:p-8"
      >
        {source && isSubjectId(source.subjectId) && (
          <p className="text-subject-ink mb-4 flex min-w-0 items-center gap-2 text-xs font-bold">
            <span className="bg-subject size-2 shrink-0 rounded-full" aria-hidden="true" />
            <span className="truncate">
              {ts(source.subjectId)} · {source.unitTitle}
            </span>
          </p>
        )}
        <p className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">{t("question")}</p>
        <Markdown className="text-xl leading-snug font-semibold">{card.front}</Markdown>

        <AnimatePresence initial={false}>
          {revealed && (
            <motion.div
              key={`${card.id}-${index}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 border-t-2 border-dashed pt-5"
            >
              <p className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">{t("answer")}</p>
              <Markdown className="text-lg">{card.back}</Markdown>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!revealed ? (
        <Button ref={revealRef} size="lg" className="w-full" onClick={() => setRevealed(true)}>
          {t("showAnswer")}
          <kbd className="ml-2 hidden rounded border border-current/40 px-1.5 text-xs sm:inline">{t("keySpace")}</kbd>
        </Button>
      ) : (
        <div>
          <p id="rate-hint" className="mb-2 text-center text-sm font-semibold">
            {t("rateHint")}
          </p>
          <div role="group" aria-labelledby="rate-hint" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {RATINGS.map((rating, i) => (
              <Button
                key={rating}
                ref={rating === "good" ? goodRef : undefined}
                variant="outline"
                onClick={() => rate(rating)}
                className={cn("h-auto flex-col gap-0.5 border-2 py-2.5", RATING_STYLE[rating])}
              >
                <span className="font-bold">{t(`rating.${rating}`)}</span>
                <span className="text-xs font-medium text-muted-foreground">
                  {rating === "again" ? t("againLater") : t("inDays", { count: intervals[i] })}
                </span>
                <kbd className="sr-only">{i + 1}</kbd>
              </Button>
            ))}
          </div>
          <p className="mt-2 hidden text-center text-xs text-muted-foreground sm:block">{t("keysHint")}</p>
        </div>
      )}
    </section>
  );
}
