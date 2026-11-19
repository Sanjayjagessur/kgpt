"use client";

import { CalendarClock, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addExam, removeExam } from "@/server/actions/exams";
import type { NextExam } from "@/server/today";

/**
 * Countdown to the student's next exam, or a small form to add one.
 * `suggestedLabel` pre-fills the name (e.g. "NCE" for Grade 9); the student sets the date.
 */
export function ExamCard({
  exam,
  suggestedLabel,
  today,
}: {
  exam: NextExam | null;
  suggestedLabel: string;
  today: string;
}) {
  const t = useTranslations("today");
  const format = useFormatter();
  const ids = { label: useId(), date: useId() };
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (exam) {
    return (
      <section aria-labelledby="exam-title" className="rounded-2xl bg-foreground p-5 text-background sm:p-6">
        <div className="-mt-2 -mr-2 flex items-center justify-between gap-2">
          <h2 id="exam-title" className="text-sm font-bold tracking-wide uppercase opacity-80">
            {t("examTitle")}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("examRemove", { label: exam.label })}
            disabled={pending}
            className="text-background hover:bg-background/15 hover:text-background"
            onClick={() =>
              startTransition(async () => {
                const res = await removeExam(exam.id);
                if (!res.ok) toast.error(t("examError"));
              })
            }
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <p className="mt-2 flex items-baseline gap-2">
          <span className="font-heading text-5xl leading-none font-extrabold">{exam.daysLeft}</span>
          <span className="text-lg font-bold">{t("examDays", { count: exam.daysLeft })}</span>
        </p>
        <p className="mt-2 opacity-85">
          {t("examOn", {
            label: exam.label,
            date: format.dateTime(new Date(`${exam.date}T12:00:00Z`), { weekday: "long", day: "numeric", month: "long" }),
          })}
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="exam-title" className="rounded-2xl bg-card p-5 shadow-sm sm:p-6">
      <h2 id="exam-title" className="flex items-center gap-2 font-bold">
        <CalendarClock className="size-5 text-primary" aria-hidden="true" />
        {t("examAddTitle")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("examAddBody")}</p>
      <form
        className="mt-4 grid gap-3"
        action={(data) =>
          startTransition(async () => {
            setError(null);
            const res = await addExam({ label: String(data.get("label") ?? ""), date: String(data.get("date") ?? "") });
            if (!res.ok) setError(res.error === "date" ? t("examDateError") : t("examError"));
          })
        }
      >
        <div className="grid gap-1.5">
          <Label htmlFor={ids.label}>{t("examLabel")}</Label>
          <Input id={ids.label} name="label" required maxLength={80} defaultValue={suggestedLabel} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={ids.date}>{t("examDate")}</Label>
          <Input
            id={ids.date}
            name="date"
            type="date"
            required
            min={today}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${ids.date}-error` : undefined}
          />
        </div>
        {error && (
          <p id={`${ids.date}-error`} role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {t("examSave")}
        </Button>
      </form>
    </section>
  );
}
