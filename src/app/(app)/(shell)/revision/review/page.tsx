import { CalendarCheck } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Breadcrumbs } from "@/components/learning/breadcrumbs";
import { FlashcardSession } from "@/components/revision/flashcard-session";
import { ButtonLink } from "@/components/ui/button-link";
import { isoDay } from "@/lib/streak";
import { getDueCards } from "@/server/revision";
import { requireStudent } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("revision");
  return { title: t("reviewTitle") };
}

/** Today's queue: every due flashcard across the student's subjects. */
export default async function ReviewPage() {
  const student = await requireStudent();
  const today = isoDay(new Date());
  const [t, tn, locale] = await Promise.all([getTranslations("revision"), getTranslations("nav"), getLocale()]);
  const cards = await getDueCards(student, today, locale);

  return (
    <div className="max-w-3xl">
      <Breadcrumbs items={[{ href: "/revision", label: tn("revision") }, { label: t("reviewTitle") }]} />
      <PageHeader title={t("reviewTitle")} description={cards.length ? t("reviewBody") : undefined} />
      {cards.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title={t("caughtUp")}
          body={t("caughtUpBody")}
          action={<ButtonLink href="/revision">{t("backToRevision")}</ButtonLink>}
        />
      ) : (
        <FlashcardSession cards={cards} today={today} persist doneHref="/revision" doneLabel={t("backToRevision")} />
      )}
    </div>
  );
}
