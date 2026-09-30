import { BookDashed, CheckCircle2, Layers, ListChecks, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { ReefLine } from "@/components/common/reef-line";
import { SubjectArt } from "@/components/common/subject-art";
import { Breadcrumbs } from "@/components/learning/breadcrumbs";
import { DueBadge } from "@/components/revision/revision-nav";
import { isSubjectId, SUBJECTS, subjectStyle } from "@/config/subjects";
import { revisionHref } from "@/lib/revision";
import { isoDay } from "@/lib/streak";
import { localized } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { getSubjectRevisionUnits } from "@/server/revision";
import { requireStudent } from "@/server/session";

export async function generateMetadata(props: PageProps<"/revision/[subject]">): Promise<Metadata> {
  const { subject } = await props.params;
  if (!isSubjectId(subject)) return {};
  const [ts, tn] = await Promise.all([getTranslations("subjects"), getTranslations("nav")]);
  return { title: `${ts(subject)} · ${tn("revision")}` };
}

export default async function RevisionSubjectPage(props: PageProps<"/revision/[subject]">) {
  const { subject } = await props.params;
  if (!isSubjectId(subject)) notFound();
  const student = await requireStudent();
  if (!SUBJECTS[subject].grades.includes(student.profile.grade)) notFound();

  const [t, tl, ts, tc, tn, locale, units] = await Promise.all([
    getTranslations("revision"),
    getTranslations("learn"),
    getTranslations("subjects"),
    getTranslations("common"),
    getTranslations("nav"),
    getLocale(),
    getSubjectRevisionUnits(student, subject, isoDay(new Date())),
  ]);

  return (
    <div style={subjectStyle(subject)}>
      <Breadcrumbs items={[{ href: "/revision", label: tn("revision") }, { label: ts(subject) }]} />

      <header className="bg-subject-tint relative mb-8 overflow-hidden rounded-2xl p-5 sm:p-7">
        <SubjectArt
          subject={subject}
          className="pointer-events-none absolute -right-6 -bottom-4 w-36 opacity-90 sm:right-4 sm:bottom-auto sm:top-1/2 sm:w-52 sm:-translate-y-1/2"
        />
        <div className="relative max-w-[62%] sm:max-w-md">
          <p className="text-subject-ink text-sm font-bold">{tc("grade", { grade: student.profile.grade })}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.025em] sm:text-4xl">{ts(subject)}</h1>
          <ReefLine className="text-subject mt-3 mb-3" />
          <p className="text-sm text-muted-foreground">{t("subjectIntro")}</p>
        </div>
      </header>

      {units.length === 0 ? (
        <EmptyState icon={BookDashed} title={tl("noUnits")} body={tl("noUnitsBody", { grade: student.profile.grade })} />
      ) : (
        <ol className="space-y-3">
          {units.map((unit) => (
            <li key={unit.id}>
              <Link
                href={revisionHref(subject, unit.id)}
                className="flex items-start gap-4 rounded-xl bg-card p-4 shadow-sm transition-[box-shadow,transform] duration-200 ease-out-soft hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none sm:p-5"
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
                  <span className="block text-xs font-bold text-muted-foreground">{tl("unitLabel", { number: unit.position })}</span>
                  <span className="mt-0.5 block text-lg leading-snug font-bold">{localized(unit.title, locale)}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Layers className="size-3.5" aria-hidden="true" />
                      {unit.cards > 0 ? t("cardsCount", { count: unit.cards }) : t("noCardsYet")}
                    </span>
                    {unit.due > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-foreground">
                        <DueBadge count={unit.due} label={t("dueCount", { count: unit.due })} />
                        <span aria-hidden="true">{t("dueShort")}</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      <ListChecks className="size-3.5" aria-hidden="true" />
                      {unit.bestQuiz == null ? t("noQuizYet") : t("bestQuiz", { percent: Math.round(unit.bestQuiz) })}
                    </span>
                    {unit.mastery === "mastered" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-pollen/20 px-2 py-0.5 text-2xs font-bold text-foreground">
                        <CheckCircle2 className="size-3" aria-hidden="true" />
                        {tl("mastery.mastered")}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
