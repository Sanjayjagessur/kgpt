import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { SubjectArt } from "@/components/common/subject-art";
import { subjectStyle } from "@/config/subjects";
import { localized } from "@/lib/supabase/database.types";
import type { ContinueLesson } from "@/server/learning";
import { ProgressBar } from "./progress-bar";

export async function ContinueCard({ lesson }: { lesson: ContinueLesson | null }) {
  const t = await getTranslations("learn");
  const ts = await getTranslations("subjects");
  const locale = await getLocale();

  if (!lesson) {
    return (
      <section aria-labelledby="continue-title" className="flex items-center gap-4 rounded-xl border border-dashed p-5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 id="continue-title" className="font-bold">
            {t("startFirst")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("startFirstBody")}</p>
        </div>
      </section>
    );
  }

  const href = `/learn/${lesson.subjectId}/${lesson.unitId}/${lesson.lessonId}`;
  const pct = lesson.totalInUnit ? (lesson.completedInUnit / lesson.totalInUnit) * 100 : 0;

  return (
    <section aria-labelledby="continue-title" style={subjectStyle(lesson.subjectId)}>
      <h2 id="continue-title" className="mb-3 text-xl font-bold">
        {t("continueTitle")}
      </h2>
      <Link
        href={href}
        className="group bg-subject-tint flex items-center gap-4 rounded-xl p-4 transition-transform duration-200 ease-out-soft hover:-translate-y-0.5 active:scale-[0.99] motion-reduce:transform-none sm:p-5"
      >
        <span className="bg-subject-soft hidden size-20 shrink-0 items-center justify-center rounded-lg sm:flex">
          <SubjectArt subject={lesson.subjectId} className="w-16" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-subject-ink block text-xs font-bold">{ts(lesson.subjectId)}</span>
          <span className="mt-0.5 block truncate text-lg font-bold">{localized(lesson.lessonTitle, locale)}</span>
          <span className="mt-0.5 block truncate text-sm text-muted-foreground">
            {t("unitWithTitle", { number: lesson.unitPosition, title: localized(lesson.unitTitle, locale) })}
          </span>
          <span className="mt-3 flex items-center gap-3">
            <ProgressBar
              value={pct}
              tone="subject"
              label={t("lessonsDone", { done: lesson.completedInUnit, total: lesson.totalInUnit })}
              className="min-w-0 max-w-48 flex-1"
            />
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">
              {t("lessonsDone", { done: lesson.completedInUnit, total: lesson.totalInUnit })}
            </span>
          </span>
        </span>
        <span className="bg-subject flex size-11 shrink-0 items-center justify-center rounded-full text-card transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none">
          <ArrowRight className="size-5" aria-hidden="true" />
          <span className="sr-only">{lesson.status === "not_started" ? t("startCta") : t("continueCta")}</span>
        </span>
      </Link>
    </section>
  );
}
