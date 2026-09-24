import { BookOpenText, Layers3, MessageCircleQuestion } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/common/logo";
import { ReefLine } from "@/components/common/reef-line";
import { SubjectArt } from "@/components/common/subject-art";
import { ButtonLink } from "@/components/ui/button-link";
import { subjectStyle, type SubjectId } from "@/config/subjects";

const SHOWCASE: SubjectId[] = ["mathematics", "biology", "french", "physics", "kreol-morisien", "english"];

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const tn = await getTranslations("nav");
  const ts = await getTranslations("subjects");
  const ta = await getTranslations("auth");

  const points = [
    { icon: BookOpenText, text: t("pointLearn"), label: tn("learning") },
    { icon: MessageCircleQuestion, text: t("pointChat"), label: tn("chat") },
    { icon: Layers3, text: t("pointRevise"), label: tn("revision") },
  ];

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
        <Logo />
        <ButtonLink variant="ghost" href="/sign-in">
          {ta("signIn")}
        </ButtonLink>
      </header>

      <main id="main" className="mx-auto grid max-w-6xl gap-14 px-4 pt-8 pb-20 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pt-16">
        <section>
          <h1 className="max-w-[16ch] text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl lg:text-[3.6rem] lg:leading-[1.02]">
            {t("title")}
          </h1>
          <ReefLine className="mt-5 mb-6 w-48" />
          <p className="max-w-[46ch] text-lg text-muted-foreground">{t("body")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink size="lg" href="/sign-up">
              {t("start")}
            </ButtonLink>
            <ButtonLink size="lg" variant="outline" href="/sign-in">
              {t("signIn")}
            </ButtonLink>
          </div>

          <ul className="mt-12 grid gap-5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {points.map(({ icon: Icon, text, label }) => (
              <li key={label} className="flex gap-3 xl:flex-col">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <p className="text-sm">
                  <span className="block font-semibold">{label}</span>
                  <span className="text-muted-foreground">{text}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label={tn("learning")} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
          {SHOWCASE.map((id, i) => (
            <div
              key={id}
              style={subjectStyle(id)}
              className={`bg-subject-tint rounded-xl p-4 ${i % 2 === 1 ? "lg:translate-y-6" : ""}`}
            >
              <SubjectArt subject={id} className="mb-3 w-full" />
              <p className="text-subject-ink text-sm font-semibold">{ts(id)}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
