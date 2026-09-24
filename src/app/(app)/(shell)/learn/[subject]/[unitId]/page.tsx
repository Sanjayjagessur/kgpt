import { Check, Circle, CircleDot } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { ReefLine } from "@/components/common/reef-line";
import { Breadcrumbs } from "@/components/learning/breadcrumbs";
import { ProgressBar } from "@/components/learning/progress-bar";
import { ButtonLink } from "@/components/ui/button-link";
import { subjectStyle } from "@/config/subjects";
import { localized } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { getUnitWithLessons } from "@/server/learning";
import { requireStudent } from "@/server/session";

async function load(props: PageProps<"/learn/[subject]/[unitId]">) {
  const { subject, unitId } = await props.params;
  if (!z.uuid().safeParse(unitId).success) notFound();
  const student = await requireStudent();
  const unit = await getUnitWithLessons(student.id, unitId);
  if (!unit || unit.subject_id !== subject || unit.grade !== student.profile.grade) notFound();
  return { student, unit };
}

export async function generateMetadata(props: PageProps<"/learn/[subject]/[unitId]">): Promise<Metadata> {
  const { unit } = await load(props);
  return { title: localized(unit.title, await getLocale()) };
}

export default async function UnitPage(props: PageProps<"/learn/[subject]/[unitId]">) {
  const { unit } = await load(props);
  const [t, ts, tn, locale] = await Promise.all([
    getTranslations("learn"),
    getTranslations("subjects"),
    getTranslations("nav"),
    getLocale(),
  ]);

  const done = unit.lessons.filter((l) => l.status === "completed").length;
  const next = unit.lessons.find((l) => l.status !== "completed") ?? unit.lessons[0];
  const lessonHref = (id: string) => `/learn/${unit.subject_id}/${unit.id}/${id}`;

  return (
    <div style={subjectStyle(unit.subject_id)} className="max-w-3xl">
      <Breadcrumbs
        items={[
          { href: "/learn", label: tn("learning") },
          { href: `/learn/${unit.subject_id}`, label: ts(unit.subject_id) },
          { label: t("unitLabel", { number: unit.position }) },
        ]}
      />
      <p className="text-subject-ink text-sm font-bold">{t("unitLabel", { number: unit.position })}</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.025em] sm:text-4xl">{localized(unit.title, locale)}</h1>
      <ReefLine className="text-subject mt-3 mb-4" />
      <p className="text-muted-foreground">{localized(unit.summary, locale)}</p>

      <div className="mt-6 flex flex-col gap-4 rounded-xl bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <ProgressBar
            value={unit.lessons.length ? (done / unit.lessons.length) * 100 : 0}
            tone="subject"
            label={t("lessonsDone", { done, total: unit.lessons.length })}
            className="min-w-0 max-w-48 flex-1"
          />
          <span className="shrink-0 text-sm font-semibold whitespace-nowrap">{t("lessonsDone", { done, total: unit.lessons.length })}</span>
        </div>
        {next && (
          <ButtonLink href={lessonHref(next.id)} size="lg">
            {done === 0 ? t("startCta") : done === unit.lessons.length ? t("reviewCta") : t("continueCta")}
          </ButtonLink>
        )}
      </div>

      <ol className="mt-8 space-y-2">
        {unit.lessons.map((lesson) => {
          const objectives = Array.isArray(lesson.objectives) ? lesson.objectives.map(String) : [];
          return (
            <li key={lesson.id}>
              <Link
                href={lessonHref(lesson.id)}
                className="group flex items-start gap-4 rounded-xl p-4 transition-colors hover:bg-card"
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                    lesson.status === "completed" ? "bg-subject text-card" : "bg-subject-soft text-subject-ink",
                  )}
                >
                  {lesson.status === "completed" ? (
                    <Check className="size-4" strokeWidth={3} aria-hidden="true" />
                  ) : lesson.status === "in_progress" ? (
                    <CircleDot className="size-4" aria-hidden="true" />
                  ) : (
                    <Circle className="size-4" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-muted-foreground">
                    {t("lessonLabel", { number: lesson.position })}
                  </span>
                  <span className="block font-bold group-hover:underline group-hover:underline-offset-4">
                    {localized(lesson.title, locale)}
                    <span className="sr-only">. {t(`status.${lesson.status}`)}</span>
                  </span>
                  {objectives[0] && <span className="mt-0.5 line-clamp-1 block text-sm text-muted-foreground">{objectives[0]}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
