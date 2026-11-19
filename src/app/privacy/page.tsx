import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/common/logo";
import { ReefLine } from "@/components/common/reef-line";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return { title: t("title") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  const sections = [
    { title: t("collectTitle"), items: [t("collect1"), t("collect2"), t("collect3")] },
    { title: t("notTitle"), items: [t("not1"), t("not2")] },
    { title: t("aiTitle"), items: [t("ai1"), t("ai2")] },
    { title: t("paymentTitle"), items: [t("payment1"), t("payment2")] },
    { title: t("controlTitle"), items: [t("control1")] },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8">
      <Link href="/" className="inline-block rounded-md">
        <Logo />
      </Link>
      <main id="main" className="py-12">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <ReefLine className="mt-3 mb-5" />
        <p className="text-lg text-muted-foreground">{t("intro")}</p>
        {sections.map((s) => (
          <section key={s.title} className="mt-10">
            <h2 className="text-xl font-bold">{s.title}</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-primary">
              {s.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
