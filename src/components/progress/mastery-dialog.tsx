"use client";

import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button-link";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { MasteryMoment } from "@/lib/mastery";

/**
 * Shown once, straight after the server reports that a unit has just been
 * mastered. One animation (the badge), which MotionConfig turns off for
 * students who prefer reduced motion.
 */
export function MasteryDialog({ moment, onClose }: { moment: MasteryMoment | null; onClose: () => void }) {
  const t = useTranslations("mastery");
  const ts = useTranslations("subjects");

  return (
    <Dialog open={moment !== null} onOpenChange={(open) => !open && onClose()}>
      {moment && (
        <DialogContent className="overflow-hidden p-0 sm:max-w-md">
          <div className="flex flex-col items-center bg-foreground px-6 pt-10 pb-7 text-center text-background">
            <motion.svg
              viewBox="0 0 120 120"
              aria-hidden="true"
              className="size-28"
              initial={{ scale: 0.6, opacity: 0, rotate: -12 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
            >
              <circle cx="60" cy="60" r="56" className="fill-primary" opacity=".35" />
              <circle cx="60" cy="60" r="44" className="fill-pollen" />
              <path
                d="M60 34l7.6 15.4 17 2.5-12.3 12 2.9 16.9L60 72.8l-15.2 8 2.9-16.9-12.3-12 17-2.5z"
                fill="#5c3d00"
              />
            </motion.svg>
            <p className="mt-5 text-sm font-bold tracking-wide uppercase opacity-80">{t("eyebrow")}</p>
            <DialogTitle className="mt-1 text-3xl font-extrabold tracking-[-0.03em] text-background">
              {moment.title}
            </DialogTitle>
            <DialogDescription className="mt-1 text-background/80">
              {t("unitOf", { subject: ts(moment.subjectId as never), grade: moment.grade, unit: moment.position })}
            </DialogDescription>
          </div>

          <div className="space-y-5 p-6">
            <div>
              <p className="flex justify-between gap-3 text-sm font-bold">
                <span>{ts(moment.subjectId as never)}</span>
                <span>{t("progress", { mastered: moment.mastered, total: moment.totalUnits })}</span>
              </p>
              <div
                role="progressbar"
                aria-label={t("progress", { mastered: moment.mastered, total: moment.totalUnits })}
                aria-valuemin={0}
                aria-valuemax={moment.totalUnits}
                aria-valuenow={moment.mastered}
                className="mt-2 h-2.5 overflow-hidden rounded-full bg-sunken"
              >
                <div
                  className="h-full rounded-full bg-pollen"
                  style={{ width: `${moment.totalUnits ? (moment.mastered / moment.totalUnits) * 100 : 0}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t("keepFresh")}</p>
            </div>

            <div className="flex flex-col gap-2">
              {moment.nextUnit && (
                <ButtonLink size="lg" href={`/learn/${moment.subjectId}/${moment.nextUnit.id}`} onClick={onClose}>
                  {t("next", { title: moment.nextUnit.title })}
                  <ArrowRight aria-hidden="true" />
                </ButtonLink>
              )}
              <ButtonLink size="lg" variant="outline" href="/learn" onClick={onClose}>
                {t("backToToday")}
              </ButtonLink>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
