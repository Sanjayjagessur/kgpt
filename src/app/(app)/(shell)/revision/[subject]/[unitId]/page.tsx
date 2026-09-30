import { BookOpen, CircleAlert, Info, Layers, Lightbulb, ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { ContentPreparing } from "@/components/common/content-preparing";
import { Markdown } from "@/components/common/markdown";
import { ButtonLink } from "@/components/ui/button-link";
import { revisionHref } from "@/lib/revision";
import { localized } from "@/lib/supabase/database.types";
import { getRevisionUnit, getUnitSummary, revisionLocale } from "@/server/revision";
import { requireStudent } from "@/server/session";

type Props = PageProps<"/revision/[subject]/[unitId]">;

async function load(props: Props) {
  const { subject, unitId } = await props.params;
  if (!z.uuid().safeParse(unitId).success) notFound();
  const student = await requireStudent();
  const unit = await getRevisionUnit(student, unitId);
  if (!unit || unit.subject_id !== subject) notFound();
  return { student, unit };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { unit } = await load(props);
  const t = await getTranslations("revision");
  return { title: `${localized(unit.title, await getLocale())} · ${t("tabs.summary")}` };
}

export default async function UnitSummaryPage(props: Props) {
  const { student, unit } = await load(props);
  const t = await getTranslations("revision");
  const tl = await getTranslations("learn");
  const lang = revisionLocale(student, unit.subject_id);
  const summary = await getUnitSummary(unit.id, lang);

  if (!summary) {
    return (
      <ContentPreparing
        endpoint={`/api/revision/${unit.id}/summary`}
        title={t("preparing.summary")}
        body={t("preparingBody")}
        errorTitle={t("preparingError")}
      />
    );
  }

  return (
    <div lang={lang} className="space-y-10">
      <Markdown className="text-lg leading-relaxed font-medium">{summary.overview}</Markdown>

      <section aria-labelledby="ideas-title">
        <h2 id="ideas-title" className="mb-4 text-2xl font-bold">
          {t("keyIdeas")}
        </h2>
        <ol className="space-y-3">
          {summary.keyIdeas.map((idea, i) => (
            <li key={i} className="flex gap-4 rounded-xl bg-card p-4 shadow-sm sm:p-5">
              <span className="bg-subject-soft text-subject-ink flex size-8 shrink-0 items-center justify-center rounded-full font-heading text-sm font-extrabold">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="mb-1 font-bold">{idea.heading}</h3>
                <Markdown className="text-base">{idea.body}</Markdown>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {summary.formulas.length > 0 && (
        <section aria-labelledby="formulas-title">
          <h2 id="formulas-title" className="mb-4 text-2xl font-bold">
            {t("formulas")}
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            {summary.formulas.map((f, i) => (
              <div key={i} className="border-subject rounded-xl border-2 p-4">
                <dt className="text-subject-ink text-xs font-bold">{f.label}</dt>
                <dd className="mt-1 min-w-0">
                  <Markdown className="text-base">{f.expression}</Markdown>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {summary.keyTerms.length > 0 && (
        <section aria-labelledby="terms-title">
          <h2 id="terms-title" className="mb-4 text-2xl font-bold">
            {tl("keyTerms")}
          </h2>
          <dl className="grid gap-x-6 gap-y-3 rounded-xl bg-card p-4 shadow-sm sm:grid-cols-[auto_1fr] sm:p-5">
            {summary.keyTerms.map((term) => (
              <div key={term.term} className="contents">
                <dt>
                  <Markdown className="text-base font-semibold">{term.term}</Markdown>
                </dt>
                <dd>
                  <Markdown className="text-base text-muted-foreground">{term.definition}</Markdown>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {summary.commonMistakes.length > 0 && (
          <section aria-labelledby="mistakes-title" className="rounded-xl bg-sunken p-4 sm:p-5">
            <h2 id="mistakes-title" className="mb-3 flex items-center gap-2 text-lg font-bold">
              <CircleAlert className="size-5 text-muted-foreground" aria-hidden="true" />
              {t("commonMistakes")}
            </h2>
            <ul className="space-y-2">
              {summary.commonMistakes.map((m, i) => (
                <li key={i}>
                  <Markdown className="text-sm">{m}</Markdown>
                </li>
              ))}
            </ul>
          </section>
        )}
        {summary.examTips.length > 0 && (
          <section aria-labelledby="tips-title" className="rounded-xl bg-secondary p-4 text-secondary-foreground sm:p-5">
            <h2 id="tips-title" className="mb-3 flex items-center gap-2 text-lg font-bold">
              <Lightbulb className="size-5" aria-hidden="true" />
              {t("examTips")}
            </h2>
            <ul className="space-y-2">
              {summary.examTips.map((tip, i) => (
                <li key={i}>
                  <Markdown className="text-sm">{tip}</Markdown>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <section aria-labelledby="next-title" className="rounded-xl bg-card p-4 shadow-sm sm:p-5">
        <h2 id="next-title" className="font-bold">
          {t("nextTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("nextBody")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href={revisionHref(unit.subject_id, unit.id, "flashcards")}>
            <Layers aria-hidden="true" />
            {t("goFlashcards")}
          </ButtonLink>
          <ButtonLink href={revisionHref(unit.subject_id, unit.id, "quiz")} variant="outline">
            <ListChecks aria-hidden="true" />
            {t("goQuiz")}
          </ButtonLink>
          <ButtonLink href={`/learn/${unit.subject_id}/${unit.id}`} variant="ghost">
            <BookOpen aria-hidden="true" />
            {t("goLessons")}
          </ButtonLink>
        </div>
      </section>

      <p className="flex gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {tl("aiNote")}
      </p>
    </div>
  );
}
