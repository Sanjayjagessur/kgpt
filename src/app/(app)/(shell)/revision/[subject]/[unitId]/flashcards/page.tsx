import { CalendarClock, Layers, Repeat } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { ContentPreparing } from "@/components/common/content-preparing";
import { Markdown } from "@/components/common/markdown";
import { AddDeckButton } from "@/components/revision/add-deck-button";
import { FlashcardSession } from "@/components/revision/flashcard-session";
import { ButtonLink } from "@/components/ui/button-link";
import { revisionHref } from "@/lib/revision";
import { isoDay } from "@/lib/streak";
import { localized } from "@/lib/supabase/database.types";
import { getFlashcardDeck, getRevisionUnit, getUnitCards, revisionLocale } from "@/server/revision";
import { requireStudent } from "@/server/session";

type Props = PageProps<"/revision/[subject]/[unitId]/flashcards">;

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
  return { title: `${localized(unit.title, await getLocale())} · ${t("tabs.flashcards")}` };
}

export default async function FlashcardsPage(props: Props) {
  const { student, unit } = await load(props);
  const { practice } = await props.searchParams;
  const [t, format] = await Promise.all([getTranslations("revision"), getFormatter()]);
  const today = isoDay(new Date());
  const lang = revisionLocale(student, unit.subject_id);
  const here = revisionHref(unit.subject_id, unit.id, "flashcards");

  const [deck, cards] = await Promise.all([getFlashcardDeck(unit.id, lang), getUnitCards(student.id, unit.id, today)]);

  // The student's own cards work even if the shared deck was never generated in this language.
  if (cards.all.length === 0) {
    if (!deck) {
      return (
        <ContentPreparing
          endpoint={`/api/revision/${unit.id}/flashcards`}
          title={t("preparing.flashcards")}
          body={t("preparingBody")}
          errorTitle={t("preparingError")}
        />
      );
    }
    return (
      <section aria-labelledby="deck-title" className="space-y-6">
        <div className="rounded-xl bg-card p-5 shadow-sm sm:p-6">
          <h2 id="deck-title" className="text-2xl font-bold">
            {t("deckTitle", { count: deck.cards.length })}
          </h2>
          <p className="mt-2 text-muted-foreground">{t("deckBody")}</p>
          <div className="mt-5">
            <AddDeckButton unitId={unit.id} count={deck.cards.length} />
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-muted-foreground">{t("deckPreview")}</h3>
          <ul lang={lang} className="grid gap-3 sm:grid-cols-3">
            {deck.cards.slice(0, 3).map((card, i) => (
              <li key={i} className="rounded-xl border-2 border-dashed p-4">
                <Markdown className="text-sm font-semibold">{card.front}</Markdown>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  if (practice === "1") {
    return (
      <div lang={lang}>
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-secondary p-3 text-sm font-semibold text-secondary-foreground">
          <Repeat className="size-4 shrink-0" aria-hidden="true" />
          {t("practiceNote")}
        </p>
        <FlashcardSession cards={cards.all} today={today} persist={false} doneHref={here} doneLabel={t("backToCards")} />
      </div>
    );
  }

  const nextDue = cards.nextDue ? new Date(`${cards.nextDue}T12:00:00Z`) : null;

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-3 gap-2 rounded-xl bg-card p-4 text-center shadow-sm">
        <div>
          <dt className="text-xs font-semibold text-muted-foreground">{t("statCards")}</dt>
          <dd className="font-heading text-2xl font-extrabold tabular-nums">{cards.all.length}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-muted-foreground">{t("statDue")}</dt>
          <dd className="font-heading text-2xl font-extrabold tabular-nums text-primary">{cards.due.length}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-muted-foreground">{t("statNext")}</dt>
          <dd className="mt-1.5 text-sm font-bold">
            {cards.due.length > 0 ? t("today") : nextDue ? format.dateTime(nextDue, { day: "numeric", month: "short", timeZone: "UTC" }) : "–"}
          </dd>
        </div>
      </dl>

      {cards.due.length > 0 ? (
        <div lang={lang}>
          <FlashcardSession
            cards={cards.due}
            today={today}
            persist
            doneHref={revisionHref(unit.subject_id, unit.id, "quiz")}
            doneLabel={t("goQuiz")}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-10 text-center">
          <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <CalendarClock className="size-6" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-bold">{t("unitCaughtUp")}</h2>
          <p className="mt-1 max-w-[44ch] text-sm text-muted-foreground">
            {nextDue
              ? t("unitCaughtUpBody", { date: format.dateTime(nextDue, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) })
              : t("caughtUpBody")}
          </p>
          <ButtonLink href={`${here}?practice=1`} variant="outline" className="mt-6">
            <Layers aria-hidden="true" />
            {t("practiceAll", { count: cards.all.length })}
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
