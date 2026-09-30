import { Info } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { ContentPreparing } from "@/components/common/content-preparing";
import { ExamQuestion } from "@/components/revision/exam-question";
import { localized } from "@/lib/supabase/database.types";
import { getExamQuestions, getRevisionUnit, revisionLocale } from "@/server/revision";
import { requireStudent } from "@/server/session";

type Props = PageProps<"/revision/[subject]/[unitId]/exam">;

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
  return { title: `${localized(unit.title, await getLocale())} · ${t("tabs.exam")}` };
}

export default async function ExamPage(props: Props) {
  const { student, unit } = await load(props);
  const t = await getTranslations("revision");
  const lang = revisionLocale(student, unit.subject_id);
  const questions = await getExamQuestions(student.id, unit.id, lang);

  if (questions.length === 0) {
    return (
      <ContentPreparing
        endpoint={`/api/revision/${unit.id}/exam`}
        title={t("preparing.exam")}
        body={t("preparingBody")}
        errorTitle={t("preparingError")}
      />
    );
  }

  const totalMarks = questions.reduce((n, q) => n + q.marks, 0);
  const scored = questions.filter((q) => q.last);
  const awarded = scored.reduce((n, q) => n + (q.last?.awarded ?? 0), 0);
  const possible = scored.reduce((n, q) => n + q.marks, 0);

  return (
    <section aria-labelledby="exam-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="exam-title" className="text-2xl font-bold">
            {t("examTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("examBody", { count: questions.length, marks: totalMarks })}</p>
        </div>
        {scored.length > 0 && (
          <p className="text-sm font-semibold">{t("examProgress", { awarded, possible, done: scored.length, total: questions.length })}</p>
        )}
      </div>

      <div lang={lang} className="space-y-4">
        {questions.map((q) => (
          <ExamQuestion key={q.id} question={q} total={questions.length} />
        ))}
      </div>

      <p className="flex gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {t("markingNote")}
      </p>
    </section>
  );
}
