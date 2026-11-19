import { HeartHandshake, Phone, ShieldAlert, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/common/logo";
import { ReefLine } from "@/components/common/reef-line";
import { ButtonLink } from "@/components/ui/button-link";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help");
  return { title: t("title") };
}

/** Numbers verified against Mauritian government sources (see docs/ROADMAP.md §3). */
const URGENT = [
  { number: "999", label: "police" },
  { number: "114", label: "samu" },
] as const;
const CHILD_LINE = "113";

/** Public safeguarding page: who a student can contact, in their language. */
export default async function HelpPage() {
  const t = await getTranslations("help");

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8">
      <Link href="/" className="inline-block rounded-md">
        <Logo />
      </Link>
      <main id="main" className="py-12">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <ReefLine className="mt-3 mb-5" />
        <p className="text-lg text-muted-foreground">{t("intro")}</p>

        <section className="mt-10 rounded-xl border-2 border-destructive/40 bg-card p-5" aria-labelledby="urgent">
          <h2 id="urgent" className="flex items-center gap-2 text-xl font-bold">
            <ShieldAlert className="size-5 shrink-0 text-destructive" aria-hidden="true" />
            {t("urgentTitle")}
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {URGENT.map((u) => (
              <li key={u.number}>
                <CallLink number={u.number} label={t(u.label)} callLabel={t("call", { number: u.number })} />
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-xl border bg-card p-5" aria-labelledby="child">
          <h2 id="child" className="flex items-center gap-2 text-xl font-bold">
            <HeartHandshake className="size-5 shrink-0 text-primary" aria-hidden="true" />
            {t("childTitle")}
          </h2>
          <div className="mt-4">
            <CallLink number={CHILD_LINE} label={t("child")} callLabel={t("call", { number: CHILD_LINE })} />
          </div>
        </section>

        <section className="mt-10" aria-labelledby="talk">
          <h2 id="talk" className="flex items-center gap-2 text-xl font-bold">
            <Users className="size-5 shrink-0 text-primary" aria-hidden="true" />
            {t("talkTitle")}
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-primary">
            <li>{t("talk1")}</li>
            <li>{t("talk2")}</li>
            <li>{t("talk3")}</li>
          </ul>
        </section>

        <section className="mt-10" aria-labelledby="tutor">
          <h2 id="tutor" className="text-xl font-bold">
            {t("tutorTitle")}
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-primary">
            <li>{t("tutor1")}</li>
            <li>{t("tutor2")}</li>
            <li>{t("tutor3")}</li>
          </ul>
        </section>

        <ButtonLink href="/learn" variant="outline" className="mt-12">
          {t("back")}
        </ButtonLink>
      </main>
    </div>
  );
}

function CallLink({ number, label, callLabel }: { number: string; label: string; callLabel: string }) {
  return (
    <a
      href={`tel:${number}`}
      aria-label={`${callLabel}: ${label}`}
      className="flex min-h-14 items-center gap-4 rounded-lg bg-sunken p-3 transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Phone className="size-5" aria-hidden="true" />
      </span>
      <span>
        <span className="block font-heading text-2xl font-extrabold tracking-tight">{number}</span>
        <span className="block text-sm text-muted-foreground">{label}</span>
      </span>
    </a>
  );
}
