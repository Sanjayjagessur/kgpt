import { Info, Target } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { Markdown } from "@/components/common/markdown";
import { ReefLine } from "@/components/common/reef-line";
import { Breadcrumbs } from "@/components/learning/breadcrumbs";
import { LessonChecks } from "@/components/learning/lesson-checks";
import { LessonPreparing } from "@/components/learning/lesson-preparing";
import { WorkedExample } from "@/components/learning/worked-example";
import { subjectStyle } from "@/config/subjects";
import { contentLocale, LessonContentSchema, type LessonContent } from "@/lib/lesson-content";
import { localized } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { getLessonProgress, getUnitWithLessons } from "@/server/learning";
import { recordLessonView } from "@/server/progress-core";
import { requireStudent } from "@/server/session";

type Props = PageProps<"/learn/[subject]/[unitId]/[lessonId]">;

async function load(props: Props) {
  const { subject, unitId, lessonId } = await props.params;
  if (!z.uuid().safeParse(unitId).success || !z.uuid().safeParse(lessonId).success) notFound();
  const student = await requireStudent();
  const unit = await getUnitWithLessons(student.id, unitId);
  if (!unit || unit.subject_id !== subject || unit.grade !== student.profile.grade) notFound();
  const index = unit.lessons.findIndex((l) => l.id === lessonId);
  if (index === -1) notFound();
  return { student, unit, lesson: unit.lessons[index], next: unit.lessons[index + 1] ?? null };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { lesson } = await load(props);
  return { title: localized(lesson.title, await getLocale()) };
}

export default async function LessonPage(props: Props) {
  const { student, unit, lesson, next } = await load(props);
  const [t, ts, tn, locale] = await Promise.all([
    getTranslations("learn"),
    getTranslations("subjects"),
    getTranslations("nav"),
    getLocale(),
  ]);

  const supabase = await createClient();
  const lang = contentLocale(unit.subject_id, student.profile.ui_locale);
  const [{ data: row }, progress] = await Promise.all([
    supabase.from("lesson_content").select("content").eq("lesson_id", lesson.id).eq("locale", lang).maybeSingle(),
    getLessonProgress(student.id, lesson.id),
  ]);
  const parsed = row ? LessonContentSchema.safeParse(row.content) : null;
  const content: LessonContent | null = parsed?.success ? parsed.data : null;

  // Record the visit after the response is sent.
  after(() => recordLessonView(student.id, lesson.id));

  const unitHref = `/learn/${unit.subject_id}/${unit.id}`;
  const objectives = Array.isArray(lesson.objectives) ? lesson.objectives.map(String) : [];

  return (
    <div style={subjectStyle(unit.subject_id)} className="mx-auto max-w-3xl">
      <Breadcrumbs
        items={[
          { href: "/learn", label: tn("learning") },
          { href: `/learn/${unit.subject_id}`, label: ts(unit.subject_id) },
          { href: unitHref, label: t("unitLabel", { number: unit.position }) },
          { label: t("lessonLabel", { number: lesson.position }) },
        ]}
      />

      <header className="mb-8">
        <p className="text-subject-ink text-sm font-bold">
          {t("unitWithTitle", { number: unit.position, title: localized(unit.title, locale) })}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.025em] sm:text-4xl" lang={lang}>
          {localized(lesson.title, locale)}
        </h1>
        <ReefLine className="text-subject mt-3" />
        {objectives.length > 0 && (
          <div className="bg-subject-tint mt-6 rounded-xl p-4 sm:p-5">
            <p className="mb-2 flex items-center gap-2 text-sm font-bold">
              <Target className="text-subject size-4" aria-hidden="true" />
              {t("objectivesTitle")}
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm marker:text-current">
              {objectives.map((o) => (
                <li key={o} lang="en">
                  {o}
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>

      {!content ? (
        <LessonPreparing lessonId={lesson.id} />
      ) : (
        <div lang={lang} className="space-y-12">
          <p className="text-lg leading-relaxed font-medium">{content.hook}</p>

          {content.sections.map((section, i) => (
            <section key={i} aria-labelledby={`section-${i}`}>
              <h2 id={`section-${i}`} className="mb-3 text-2xl font-bold">
                {section.heading}
              </h2>
              <Markdown>{section.body}</Markdown>
            </section>
          ))}

          {content.workedExamples.length > 0 && (
            <section aria-labelledby="examples-title" className="space-y-4">
              <h2 id="examples-title" className="text-2xl font-bold">
                {t("workedExamples")}
              </h2>
              {content.workedExamples.map((ex, i) => (
                <WorkedExample
                  key={i}
                  index={i}
                  title={ex.title}
                  problem={<Markdown>{ex.problem}</Markdown>}
                  steps={ex.steps.map((s, j) => (
                    <Markdown key={j}>{s}</Markdown>
                  ))}
                  answer={<Markdown>{ex.answer}</Markdown>}
                />
              ))}
            </section>
          )}

          <section aria-labelledby="keypoints-title" className="rounded-xl border-2 border-subject p-4 sm:p-6">
            <h2 id="keypoints-title" className="mb-3 text-xl font-bold">
              {t("keyPoints")}
            </h2>
            <ul className="space-y-2">
              {content.keyPoints.map((point, i) => (
                <li key={i} className="flex gap-3">
                  <span className="bg-subject mt-2 size-2 shrink-0 rounded-full" aria-hidden="true" />
                  <Markdown className="text-base">{point}</Markdown>
                </li>
              ))}
            </ul>
            {content.keyTerms.length > 0 && (
              <>
                <h3 className="mt-6 mb-2 font-bold">{t("keyTerms")}</h3>
                <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
                  {content.keyTerms.map((term) => (
                    <div key={term.term} className="contents">
                      <dt className="font-semibold">{term.term}</dt>
                      <dd className="text-muted-foreground">{term.definition}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </section>

          <LessonChecks
            lessonId={lesson.id}
            alreadyCompleted={progress?.status === "completed"}
            unitHref={unitHref}
            nextHref={next ? `${unitHref}/${next.id}` : null}
            checks={content.checks.map((c) => ({
              kind: c.kind,
              question: <Markdown>{c.question}</Markdown>,
              options: c.options.map((o, j) => <Markdown key={j}>{o}</Markdown>),
              correctOption: c.correctOption,
              modelAnswer: <Markdown>{c.modelAnswer}</Markdown>,
              explanation: <Markdown className="text-sm">{c.explanation}</Markdown>,
            }))}
          />

          <p className="flex gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t("aiNote")}
          </p>
        </div>
      )}
    </div>
  );
}
