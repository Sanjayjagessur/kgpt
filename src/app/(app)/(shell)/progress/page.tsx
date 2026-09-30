import { BookCheck, Clock, Flame, Star, Target, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { SubjectArt } from "@/components/common/subject-art";
import { ProgressBar } from "@/components/learning/progress-bar";
import { formatDuration } from "@/components/progress/duration";
import { StudyChart } from "@/components/progress/study-chart";
import { subjectStyle } from "@/config/subjects";
import { revisionHref } from "@/lib/revision";
import { isoDay } from "@/lib/streak";
import { localized } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { getProgressOverview, type WeakReason } from "@/server/progress";
import { requireStudent } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("progress") };
}

export default async function ProgressPage() {
  const student = await requireStudent();
  const today = isoDay(new Date());
  const [t, tn, ts, tl, locale, overview] = await Promise.all([
    getTranslations("progress"),
    getTranslations("nav"),
    getTranslations("subjects"),
    getTranslations("learn"),
    getLocale(),
    getProgressOverview(student, today),
  ]);

  const stats = [
    { key: "streak", icon: Flame, iconClass: "text-flame fill-flame/20", value: t("days", { count: overview.streak }), label: t("currentStreak") },
    { key: "best", icon: Trophy, iconClass: "text-muted-foreground", value: t("days", { count: overview.bestStreak }), label: t("bestStreak") },
    { key: "week", icon: Clock, iconClass: "text-primary", value: formatDuration(t, overview.weekSeconds), label: t("thisWeek") },
    { key: "lessons", icon: BookCheck, iconClass: "text-primary", value: String(overview.completedLessons), label: t("lessonsCompleted") },
    { key: "mastered", icon: Star, iconClass: "text-pollen fill-pollen/30", value: String(overview.masteredUnits), label: t("unitsMastered") },
  ];

  const reasonLabel = (r: WeakReason) =>
    r.kind === "flashcards" ? t("reason.flashcards", { count: r.count }) : t(`reason.${r.kind}`, { percent: r.percent });

  return (
    <>
      <PageHeader title={tn("progress")} description={t("subtitle")} />

      <section aria-labelledby="stats-title">
        <h2 id="stats-title" className="sr-only">
          {t("statsTitle")}
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s, i) => (
            <div
              key={s.key}
              className={cn("rounded-xl bg-card p-4 shadow-sm", i === 0 && "col-span-2 sm:col-span-1")}
            >
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <s.icon className={cn("size-4", s.iconClass)} aria-hidden="true" />
                {s.label}
              </dt>
              <dd className="mt-1 font-heading text-2xl font-extrabold tracking-tight tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="time-title" className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 id="time-title" className="text-xl font-bold">
              {t("timeTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("totalTime", { time: formatDuration(t, overview.totalSeconds) })}</p>
          </div>
          <div className="rounded-xl bg-card p-4 shadow-sm sm:p-5">
            <StudyChart days={overview.days} today={today} />
          </div>
        </section>

        <section aria-labelledby="weak-title" className="min-w-0">
          <h2 id="weak-title" className="mb-3 flex items-center gap-2 text-xl font-bold">
            <Target className="size-5 text-primary" aria-hidden="true" />
            {t("weakTitle")}
          </h2>
          {overview.weak.length === 0 ? (
            <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{t("weakEmpty")}</p>
          ) : (
            <ul className="space-y-2">
              {overview.weak.map((w) => (
                <li key={w.unitId} style={subjectStyle(w.subjectId)}>
                  <Link
                    href={revisionHref(w.subjectId, w.unitId)}
                    className="flex items-start gap-3 rounded-xl bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <span className="bg-subject mt-1.5 size-2.5 shrink-0 rounded-full" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="text-subject-ink block text-xs font-bold">
                        {ts(w.subjectId)} · {tl("unitLabel", { number: w.position })}
                      </span>
                      <span className="block font-bold">{localized(w.title, locale)}</span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {w.reasons.map((r) => (
                          <span key={r.kind} className="rounded-full bg-sunken px-2 py-0.5 text-2xs font-semibold">
                            {reasonLabel(r)}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className="shrink-0 self-center text-sm font-semibold text-primary">{t("reviseCta")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="subjects-title" className="mt-10">
        <h2 id="subjects-title" className="mb-3 text-xl font-bold">
          {t("subjectsTitle")}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {overview.subjects
            .sort((a, b) => ts(a.id).localeCompare(ts(b.id)))
            .map((s) => {
              const notStarted = Math.max(s.units - s.mastered - s.learning, 0);
              const pct = s.lessons ? (s.completedLessons / s.lessons) * 100 : 0;
              return (
                <li key={s.id} style={subjectStyle(s.id)}>
                  <Link
                    href={`/learn/${s.id}`}
                    className="block h-full rounded-xl bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <span className="flex items-center gap-3">
                      <span className="bg-subject-tint flex size-10 shrink-0 items-center justify-center rounded-lg">
                        <SubjectArt subject={s.id} className="w-8" />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-bold">{ts(s.id)}</span>
                    </span>
                    <span className="mt-4 flex items-center gap-3">
                      <ProgressBar
                        value={pct}
                        tone="subject"
                        label={tl("lessonsDone", { done: s.completedLessons, total: s.lessons })}
                        className="min-w-0 flex-1"
                      />
                      <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                        {tl("lessonsDone", { done: s.completedLessons, total: s.lessons })}
                      </span>
                    </span>
                    {s.units > 0 && (
                      <>
                        {/* Units by mastery level; the text below carries the same counts. */}
                        <span aria-hidden="true" className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full">
                          {s.mastered > 0 && <span className="bg-pollen" style={{ flexGrow: s.mastered }} />}
                          {s.learning > 0 && <span className="bg-primary/60" style={{ flexGrow: s.learning }} />}
                          {notStarted > 0 && <span className="bg-sunken" style={{ flexGrow: notStarted }} />}
                        </span>
                        <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-2xs font-semibold text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <span className="size-2 rounded-full bg-pollen" aria-hidden="true" />
                            {t("unitsMasteredCount", { count: s.mastered })}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="size-2 rounded-full bg-primary/60" aria-hidden="true" />
                            {t("unitsLearningCount", { count: s.learning })}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="size-2 rounded-full bg-sunken ring-1 ring-border" aria-hidden="true" />
                            {t("unitsNotStartedCount", { count: notStarted })}
                          </span>
                        </span>
                      </>
                    )}
                  </Link>
                </li>
              );
            })}
        </ul>
      </section>
    </>
  );
}
