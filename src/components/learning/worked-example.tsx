"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Reveals a worked example one step at a time so students can predict the
 * next step before seeing it. Markdown is pre-rendered on the server.
 */
export function WorkedExample({
  index,
  title,
  problem,
  steps,
  answer,
}: {
  index: number;
  title: string;
  problem: React.ReactNode;
  steps: React.ReactNode[];
  answer: React.ReactNode;
}) {
  const t = useTranslations("learn");
  const [shown, setShown] = useState(0);
  const listRef = useRef<HTMLOListElement>(null);
  const done = shown >= steps.length;

  function reveal(count: number) {
    setShown(count);
    // Move focus to the newest step so keyboard and screen reader users follow along.
    requestAnimationFrame(() => {
      const items = listRef.current?.querySelectorAll<HTMLElement>("[data-step]");
      items?.[Math.min(count, steps.length) - 1]?.focus();
    });
  }

  return (
    <article className="rounded-xl bg-card p-4 shadow-sm sm:p-6">
      <p className="text-xs font-bold text-primary">{t("exampleN", { n: index + 1 })}</p>
      <h3 className="mt-1 text-lg font-bold">{title}</h3>
      <div className="mt-3">{problem}</div>

      <ol ref={listRef} className="mt-5 space-y-3">
        <AnimatePresence initial={false}>
          {steps.slice(0, shown).map((step, i) => (
            <motion.li
              key={i}
              data-step
              tabIndex={-1}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex gap-3 rounded-lg bg-sunken p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <span className="sr-only">{t("stepN", { n: i + 1 })}: </span>
                {step}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>

      {done ? (
        <div className="mt-4 rounded-lg border-2 border-primary/30 bg-secondary p-3 text-secondary-foreground">
          <p className="mb-1 text-xs font-bold">{t("answer")}</p>
          {answer}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => reveal(shown + 1)}>{t("showNextStep")}</Button>
          <Button variant="ghost" onClick={() => reveal(steps.length)}>
            {t("showAllSteps")}
          </Button>
        </div>
      )}
    </article>
  );
}
