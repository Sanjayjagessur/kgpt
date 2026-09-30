import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { ContentPreparing } from "@/components/common/content-preparing";
import { QuizRunner } from "@/components/revision/quiz-runner";
import { revisionHref } from "@/lib/revision";
import { localized } from "@/lib/supabase/database.types";
import { getQuizBank, getQuizHistory, getRevisionUnit, revisionLocale } from "@/server/revision";
import { requireStudent } from "@/server/session";

type Props = PageProps<"/revision/[subject]/[unitId]/quiz">;

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
  return { title: `${localized(unit.title, await getLocale())} · ${t("tabs.quiz")}` };
}

export default async function QuizPage(props: Props) {
  const { student, unit } = await load(props);
  const t = await getTranslations("revision");
  const lang = revisionLocale(student, unit.subject_id);
  const [bank, history] = await Promise.all([getQuizBank(unit.id, lang), getQuizHistory(student.id, unit.id)]);

  if (!bank) {
    return (
      <ContentPreparing
        endpoint={`/api/revision/${unit.id}/quiz`}
        title={t("preparing.quiz")}
        body={t("preparingBody")}
        errorTitle={t("preparingError")}
      />
    );
  }

  return (
    <QuizRunner
      unitId={unit.id}
      bankSize={bank.questions.length}
      best={history.best}
      attempts={history.attempts}
      summaryHref={revisionHref(unit.subject_id, unit.id)}
      lang={lang}
    />
  );
}
