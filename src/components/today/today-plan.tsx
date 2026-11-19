import { ArrowRight, BookOpen, Layers3, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { subjectStyle } from "@/config/subjects";
import { localized } from "@/lib/supabase/database.types";
import type { TodayPlan as Plan } from "@/server/today";

type Step = {
  key: string;
  href: string;
  icon: typeof BookOpen;
  title: string;
  detail: string;
  minutes: number;
  style?: React.CSSProperties;
};

/** Rough study time per step, shown to help the student plan. */
const MINUTES = { perCard: 0.5, lesson: 12, quiz: 7 };

/**
 * The Today plan: one clear first step, then up to two more. Steps come only
 * from the student's own data (due cards, lesson in progress, weakest unit).
 */
export async function TodayPlan({ plan }: { plan: Plan }) {
  const t = await getTranslations("today");
  const ts = await getTranslations("subjects");
  const locale = await getLocale();
  const format = await getFormatter();

  const steps: Step[] = [];
  if (plan.dueCards > 0) {
    steps.push({
      key: "cards",
      href: "/revision/review",
      icon: Layers3,
      title: t("cardsTitle", { count: plan.dueCards }),
      detail: t("cardsDetail"),
      minutes: Math.max(2, Math.ceil(plan.dueCards * MINUTES.perCard)),
    });
  }
  const lesson = plan.continueLesson;
  if (lesson) {
    steps.push({
      key: "lesson",
      href: `/learn/${lesson.subjectId}/${lesson.unitId}/${lesson.lessonId}`,
      icon: BookOpen,
      title: t(lesson.status === "not_started" ? "lessonStartTitle" : "lessonTitle", {
        title: localized(lesson.lessonTitle, locale),
      }),
      detail: `${ts(lesson.subjectId)} · ${localized(lesson.unitTitle, locale)}`,
      minutes: MINUTES.lesson,
      style: subjectStyle(lesson.subjectId),
    });
  }
  const weak = plan.weakSpot;
  if (weak) {
    steps.push({
      key: "weak",
      href: `/revision/${weak.subjectId}/${weak.unitId}/quiz`,
      icon: Target,
      title: t("weakTitle", { title: localized(weak.unitTitle, locale) }),
      detail: weak.quiz
        ? t("weakQuiz", {
            subject: ts(weak.subjectId),
            score: Math.round(weak.quiz.score),
            date: format.dateTime(new Date(weak.quiz.at), { day: "numeric", month: "short" }),
          })
        : t("weakNoQuiz", { subject: ts(weak.subjectId) }),
      minutes: MINUTES.quiz,
      style: subjectStyle(weak.subjectId),
    });
  }

  if (!steps.length) {
    return (
      <section aria-labelledby="plan-title" className="flex items-center gap-4 rounded-2xl border border-dashed p-6">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 id="plan-title" className="font-bold">
            {t("emptyTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("emptyBody")}</p>
        </div>
      </section>
    );
  }

  const [first, ...rest] = steps;
  const total = steps.reduce((sum, s) => sum + s.minutes, 0);
  const FirstIcon = first.icon;

  return (
    <section aria-labelledby="plan-title" className="rounded-2xl bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="plan-title" className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
          {t("planTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("planTime", { minutes: total })}</p>
      </div>

      <Link
        href={first.href}
        style={first.style}
        className="group flex items-center gap-4 rounded-xl bg-secondary p-4 transition-transform duration-200 ease-out-soft hover:-translate-y-0.5 active:scale-[0.99] motion-reduce:transform-none sm:p-5"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:size-14">
          <FirstIcon className="size-6" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-secondary-foreground">
            {t("stepLabel", { step: 1, minutes: first.minutes })}
          </span>
          <span className="mt-0.5 block text-xl font-extrabold tracking-[-0.02em] sm:text-2xl">{first.title}</span>
          <span className="mt-0.5 block truncate text-sm text-muted-foreground">{first.detail}</span>
        </span>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none">
          <ArrowRight className="size-5" aria-hidden="true" />
          <span className="sr-only">{t("start")}</span>
        </span>
      </Link>

      {rest.length > 0 && (
        <ol className="mt-3 divide-y" start={2}>
          {rest.map((step, i) => (
            <li key={step.key}>
              <Link href={step.href} className="flex items-center gap-3 rounded-md px-1 py-3 hover:bg-sunken">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold text-muted-foreground"
                >
                  {i + 2}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{step.title}</span>
                  <span className="block truncate text-sm text-muted-foreground">{step.detail}</span>
                </span>
                <span className="shrink-0 text-sm text-muted-foreground">{t("minutes", { minutes: step.minutes })}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
