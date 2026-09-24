import { BookDashed, CheckCircle2, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { ReefLine } from "@/components/common/reef-line";
import { SubjectArt } from "@/components/common/subject-art";
import { Breadcrumbs } from "@/components/learning/breadcrumbs";
import { ProgressBar } from "@/components/learning/progress-bar";
import { isSubjectId, SUBJECTS, subjectStyle } from "@/config/subjects";
import { localized } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { getSubjectUnits } from "@/server/learning";
import { requireStudent } from "@/server/session";

export async function generateMetadata(props: PageProps<"/learn/[subject]">): Promise<Metadata> {
  const { subject } = await props.params;
  if (!isSubjectId(subject)) return {};
  const ts = await getTranslations("subjects");
  return { title: ts(subject) };
}

export default async function SubjectPage(props: PageProps<"/learn/[subject]">) {
  const { subject } = await props.params;
  if (!isSubjectId(subject)) notFound();
  const student = await requireStudent();
  if (!SUBJECTS[subject].grades.includes(student.profile.grade)) notFound();

  const [t, ts, tc, tn, locale, units] = await Promise.all([
    getTranslations("learn"),
    getTranslations("subjects"),
    getTranslations("common"),
    getTranslations("nav"),
    getLocale(),
    getSubjectUnits(student.id, subject, student.profile.grade),
  ]);

  const total = units.reduce((n, u) => n + u.totalLessons, 0);
  const done = units.reduce((n, u) => n + u.completedLessons, 0);
  const pct = total ? (done / total) * 100 : 0;

  return (
    <div style={subjectStyle(subject)}>
      <Breadcrumbs items={[{ href: "/learn", label: tn("learning") }, { label: ts(subject) }]} />

      <header className="bg-subject-tint relative mb-8 overflow-hidden rounded-2xl p-5 sm:p-8">
        <SubjectArt
          subject={subject}
          className="pointer-events-none absolute -right-6 -bottom-4 w-44 opacity-90 sm:right-4 sm:bottom-auto sm:top-1/2 sm:w-64 sm:-translate-y-1/2"
        />
        <div className="relative max-w-[60%] sm:max-w-md">
          <p className="text-subject-ink text-sm font-bold">{tc("grade", { grade: student.profile.grade })}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.025em] sm:text-4xl">{ts(subject)}</h1>
          <ReefLine className="text-subject mt-3 mb-4" />
          <p className="text-sm font-semibold text-muted-foreground">
            {t("unitsCount", { count: units.length })}, {t("lessonsCount", { count: total })}
          </p>
          {total > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <ProgressBar value={pct} tone="subject" label={t("progressPercent", { percent: Math.round(pct) })} className="min-w-0 max-w-56 flex-1" />
              <span className="shrink-0 text-xs font-bold whitespace-nowrap">{t("progressPercent", { percent: Math.round(pct) })}</span>
            </div>
          )}
        </div>
      </header>

      {units.length === 0 ? (
        <EmptyState icon={BookDashed} title={t("noUnits")} body={t("noUnitsBody", { grade: student.profile.grade })} />
      ) : (
        <ol className="relative space-y-3">
          {units.map((unit) => {
            const unitPct = unit.totalLessons ? (unit.completedLessons / unit.totalLessons) * 100 : 0;
            return (
              <li key={unit.id}>
                <Link
                  href={`/learn/${subject}/${unit.id}`}
                  className="group flex items-start gap-4 rounded-xl bg-card p-4 shadow-sm transition-[box-shadow,transform] duration-200 ease-out-soft hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none sm:p-5"
                >
                  <span
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-full font-heading text-lg font-extrabold tabular-nums",
                      unit.mastery === "mastered" ? "bg-subject text-card" : "bg-subject-soft text-subject-ink",
                    )}
                  >
                    {unit.mastery === "mastered" ? <Star className="size-5 fill-current" aria-hidden="true" /> : unit.position}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-muted-foreground">{t("unitLabel", { number: unit.position })}</span>
                    <span className="mt-0.5 block text-lg leading-snug font-bold">{localized(unit.title, locale)}</span>
                    <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{localized(unit.summary, locale)}</span>
                    <span className="mt-3 flex items-center gap-3">
                      <ProgressBar
                        value={unitPct}
                        tone="subject"
                        label={t("lessonsDone", { done: unit.completedLessons, total: unit.totalLessons })}
                        className="min-w-0 max-w-40 flex-1"
                      />
                      <span className="shrink-0 text-xs font-semibold whitespace-nowrap text-muted-foreground">
                        {t("lessonsDone", { done: unit.completedLessons, total: unit.totalLessons })}
                      </span>
                      {unit.mastery !== "not_started" && (
                        <span
                          className={cn(
                            "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-bold",
                            unit.mastery === "mastered" ? "bg-pollen/20 text-foreground" : "bg-secondary text-secondary-foreground",
                          )}
                        >
                          {unit.mastery === "mastered" && <CheckCircle2 className="size-3" aria-hidden="true" />}
                          {t(`mastery.${unit.mastery}`)}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
