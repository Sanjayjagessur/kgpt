import { ArrowRight, CalendarCheck, ClipboardCheck, Layers, ListChecks, PenLine, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getLocale, getNow, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { SubjectArt } from "@/components/common/subject-art";
import { DueBadge } from "@/components/revision/revision-nav";
import { ButtonLink } from "@/components/ui/button-link";
import { subjectStyle } from "@/config/subjects";
import { revisionHref } from "@/lib/revision";
import { isoDay } from "@/lib/streak";
import { localized } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { getRecentRevision, getRevisionSubjects, type RevisionActivity } from "@/server/revision";
import { requireStudent } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("revision") };
}

const KIND_ICON = { flashcards: Layers, quiz: ListChecks, exam: PenLine } as const;

export default async function RevisionPage() {
  const student = await requireStudent();
  const today = isoDay(new Date());
  const supabase = await createClient();
  const [t, tn, ts, locale, format, now, subjects, recent, { count: totalCards }] = await Promise.all([
    getTranslations("revision"),
    getTranslations("nav"),
    getTranslations("subjects"),
    getLocale(),
    getFormatter(),
    getNow(),
    getRevisionSubjects(student, today),
    getRecentRevision(student),
    supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", student.id),
  ]);
  const due = subjects.reduce((n, s) => n + s.due, 0);
  const last = recent[0] ?? null;

  const resultLabel = (a: RevisionActivity) => {
    if (!a.result) return t("activity.flashcards");
    if ("score" in a.result) return t("activity.quiz", { percent: Math.round(a.result.score) });
    return t("activity.exam", { awarded: a.result.awarded, marks: a.result.marks });
  };

  return (
    <>
      <PageHeader title={tn("revision")} description={t("subtitle")} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Today's flashcard queue */}
        <section aria-labelledby="due-title" className="flex flex-col rounded-xl bg-card p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <CalendarCheck className="size-6" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="due-title" className="text-sm font-bold text-muted-foreground">
                {t("dueTitle")}
              </h2>
              <p className="mt-0.5 font-heading text-2xl font-extrabold tracking-tight">
                {due > 0 ? t("dueCards", { count: due }) : t("caughtUp")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {due > 0 ? t("dueBody") : totalCards ? t("caughtUpBody") : t("noCardsBody")}
              </p>
            </div>
          </div>
          {due > 0 && (
            <ButtonLink href="/revision/review" size="lg" className="mt-5 self-start">
              {t("reviewNow")}
            </ButtonLink>
          )}
        </section>

        {/* Continue where the student last revised */}
        <section aria-labelledby="continue-revision-title" className="flex flex-col">
          {last ? (
            <Link
              href={revisionHref(last.subjectId, last.unitId, last.kind)}
              style={subjectStyle(last.subjectId)}
              className="group bg-subject-tint flex h-full items-center gap-4 rounded-xl p-5 transition-transform duration-200 ease-out-soft hover:-translate-y-0.5 active:scale-[0.99] motion-reduce:transform-none"
            >
              <SubjectArt subject={last.subjectId} className="hidden w-16 shrink-0 sm:block" />
              <span className="min-w-0 flex-1">
                <span id="continue-revision-title" className="block text-sm font-bold text-muted-foreground">
                  {t("continueTitle")}
                </span>
                <span className="text-subject-ink mt-1 block text-xs font-bold">{ts(last.subjectId)}</span>
                <span className="mt-0.5 block truncate text-lg font-bold">{localized(last.unitTitle, locale)}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{t(`tabs.${last.kind}`)}</span>
              </span>
              <span className="bg-subject flex size-11 shrink-0 items-center justify-center rounded-full text-card transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none">
                <ArrowRight className="size-5" aria-hidden="true" />
              </span>
            </Link>
          ) : (
            <div className="flex h-full items-center gap-4 rounded-xl border border-dashed p-5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <Sparkles className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 id="continue-revision-title" className="font-bold">
                  {t("startTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">{t("startBody")}</p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* On large screens the subjects are in the sidebar. */}
      <section aria-labelledby="subjects-title" className="mt-10 lg:hidden">
        <h2 id="subjects-title" className="mb-3 text-xl font-bold">
          {t("yourSubjects")}
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[...subjects]
            .sort((a, b) => ts(a.id).localeCompare(ts(b.id)))
            .map((s) => (
              <li key={s.id} style={subjectStyle(s.id)}>
                <Link
                  href={`/revision/${s.id}`}
                  className="flex min-h-14 items-center gap-3 rounded-xl bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
                >
                  <span className="bg-subject-tint flex size-10 shrink-0 items-center justify-center rounded-lg">
                    <SubjectArt subject={s.id} className="w-8" />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{ts(s.id)}</span>
                  {s.due > 0 && <DueBadge count={s.due} label={t("dueCount", { count: s.due })} />}
                </Link>
              </li>
            ))}
        </ul>
      </section>

      <section aria-labelledby="recent-title" className="mt-10">
        <h2 id="recent-title" className="mb-3 text-xl font-bold">
          {t("recentTitle")}
        </h2>
        {recent.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            <ClipboardCheck className="size-4 shrink-0" aria-hidden="true" />
            {t("recentEmpty")}
          </p>
        ) : (
          <ul className="divide-y rounded-xl bg-card shadow-sm">
            {recent.map((a) => {
              const Icon = KIND_ICON[a.kind];
              return (
                <li key={`${a.kind}-${a.at}`} style={subjectStyle(a.subjectId)}>
                  <Link href={revisionHref(a.subjectId, a.unitId, a.kind)} className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/50">
                    <span className="bg-subject-soft text-subject-ink flex size-9 shrink-0 items-center justify-center rounded-full">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{localized(a.unitTitle, locale)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {ts(a.subjectId)} · {format.relativeTime(new Date(a.at), now)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums">{resultLabel(a)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
