import { BookOpen, HeartHandshake, Lightbulb, Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo, LogoMark } from "@/components/common/logo";
import { ReefLine } from "@/components/common/reef-line";
import { ButtonLink } from "@/components/ui/button-link";
import { subjectStyle, type SubjectId } from "@/config/subjects";

/** Stages shown in the syllabus section; colours borrow a subject hue for each. */
const STAGES: { key: "ncf" | "sc" | "hsc"; hue: SubjectId }[] = [
  { key: "ncf", hue: "mathematics" },
  { key: "sc", hue: "biology" },
  { key: "hsc", hue: "kreol-morisien" },
];

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const ta = await getTranslations("auth");
  const tl = await getTranslations("languages");

  const safety = [
    { icon: ShieldCheck, title: t("safety.checkedTitle"), body: t("safety.checkedBody") },
    { icon: Lock, title: t("safety.privateTitle"), body: t("safety.privateBody") },
    { icon: Lightbulb, title: t("safety.hintsTitle"), body: t("safety.hintsBody") },
    { icon: HeartHandshake, title: t("safety.careTitle"), body: t("safety.careBody") },
  ];

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-5 sm:px-8">
        <Logo />
        <nav aria-label={t("navLabel")} className="ml-auto flex flex-wrap items-center gap-1">
          <a href="#syllabus" className="hidden rounded-md px-3 py-2 font-semibold text-muted-foreground hover:text-foreground md:inline-block">
            {t("navSyllabus")}
          </a>
          <a href="#safety" className="hidden rounded-md px-3 py-2 font-semibold text-muted-foreground hover:text-foreground md:inline-block">
            {t("navSafety")}
          </a>
          <ButtonLink variant="ghost" href="/sign-in">
            {ta("signIn")}
          </ButtonLink>
        </nav>
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pt-6 pb-20 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pt-14">
          <div>
            <p className="mb-4 inline-flex rounded-full bg-secondary px-3 py-1 text-sm font-bold text-secondary-foreground">
              {t("badge")}
            </p>
            <h1 className="max-w-[16ch] text-4xl font-extrabold tracking-[-0.035em] sm:text-5xl lg:text-[3.6rem] lg:leading-[1.02]">
              {t("title")}
            </h1>
            <ReefLine className="mt-5 mb-6 w-48" />
            <p className="max-w-[48ch] text-lg text-muted-foreground">{t("body")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink size="lg" href="/sign-up">
                {t("start")}
              </ButtonLink>
              <ButtonLink size="lg" variant="outline" href="/sign-in">
                {t("signIn")}
              </ButtonLink>
            </div>
            <ul aria-label={t("languagesLabel")} className="mt-8 flex flex-wrap gap-2">
              {(["en", "fr", "mfe"] as const).map((l) => (
                <li key={l} className="rounded-full border bg-card px-3 py-1 text-sm font-semibold">
                  {tl(l)}
                </li>
              ))}
            </ul>
          </div>

          {/* A static example of the tutor (not interactive): Grade 9 maths, homework mode. */}
          <figure aria-label={t("demo.label")} className="rounded-2xl bg-card p-5 shadow-lg sm:p-6">
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <span className="size-2.5 rounded-full bg-primary" aria-hidden="true" />
              {t("demo.mode")}
            </p>
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 font-semibold text-primary-foreground">
              {t("demo.question")}
            </p>
            <div className="mt-4 flex gap-3">
              <LogoMark className="mt-0.5 shrink-0" />
              <div className="min-w-0 space-y-3">
                <p
                  style={subjectStyle("mathematics")}
                  className="bg-subject-soft text-subject-ink inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
                >
                  <BookOpen className="size-3.5" aria-hidden="true" />
                  {t("demo.unit")}
                </p>
                <p>{t("demo.reply")}</p>
                <div className="rounded-lg bg-sunken p-3">
                  <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{t("demo.hintLabel")}</p>
                  <p className="mt-1">{t("demo.hint")}</p>
                </div>
              </div>
            </div>
            <figcaption className="mt-4 border-t pt-3 text-sm text-muted-foreground">{t("demo.caption")}</figcaption>
          </figure>
        </section>

        <section id="syllabus" className="border-y bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-20">
            <h2 className="text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">{t("syllabus.title")}</h2>
            <p className="mt-3 max-w-[60ch] text-lg text-muted-foreground">{t("syllabus.body")}</p>
            <ul className="mt-10 grid gap-5 md:grid-cols-3">
              {STAGES.map(({ key, hue }) => (
                <li key={key} style={subjectStyle(hue)} className="bg-subject-tint rounded-xl p-6">
                  <p className="text-subject-ink font-bold">{t(`syllabus.${key}Grades`)}</p>
                  <h3 className="mt-1 text-2xl font-extrabold tracking-[-0.02em]">{t(`syllabus.${key}Title`)}</h3>
                  <p className="mt-2 text-muted-foreground">{t(`syllabus.${key}Body`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="safety" className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_1.5fr]">
          <div>
            <h2 className="text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">{t("safety.title")}</h2>
            <p className="mt-3 text-lg text-muted-foreground">{t("safety.body")}</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {safety.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-xl bg-card p-5 shadow-sm">
                <Icon className="size-7 text-primary" aria-hidden="true" />
                <h3 className="mt-3 text-lg font-bold">{title}</h3>
                <p className="mt-1 text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-foreground text-background">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-8 sm:py-20 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">{t("language.title")}</h2>
              <p className="mt-3 text-lg opacity-85">{t("language.body")}</p>
            </div>
            <ul className="flex flex-col gap-3">
              {(["en", "fr", "mfe"] as const).map((l, i) => (
                <li
                  key={l}
                  lang={l === "mfe" ? "mfe" : l}
                  className={`w-fit max-w-full rounded-xl border border-background/20 bg-background/10 px-4 py-3 ${i === 1 ? "lg:ml-10" : i === 2 ? "lg:ml-20" : ""}`}
                >
                  <span className="mr-2 font-bold">{l.toUpperCase()}</span>
                  {t(`language.${l}`)}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-8">
          <h2 className="text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">{t("cta.title")}</h2>
          <p className="mx-auto mt-3 max-w-[50ch] text-lg text-muted-foreground">{t("cta.body")}</p>
          <ButtonLink size="lg" href="/sign-up" className="mt-8">
            {t("cta.button")}
          </ButtonLink>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted-foreground sm:px-8">
          <span>{t("footer.made")}</span>
          <Link href="/privacy" className="hover:text-foreground sm:ml-auto">
            {t("footer.privacy")}
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            {t("footer.terms")}
          </Link>
          <Link href="/help" className="hover:text-foreground">
            {t("footer.help")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
