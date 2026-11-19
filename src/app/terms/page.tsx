import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Logo } from "@/components/common/logo";
import { ReefLine } from "@/components/common/reef-line";
import { billingConfig } from "@/config/billing";
import { siteConfig } from "@/config/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("terms");
  return { title: t("title") };
}

export default async function TermsPage() {
  const [t, format] = await Promise.all([getTranslations("terms"), getFormatter()]);
  const app = siteConfig.name;
  const sections = [
    { title: t("useTitle", { app }), items: [t("use1", { app }), t("use2"), t("use3")] },
    { title: t("aiTitle"), items: [t("ai1"), t("ai2", { app })] },
    {
      title: t("plansTitle"),
      items: [t("plans1", { days: billingConfig.trialDays }), t("plans2"), t("plans3")],
    },
    { title: t("paymentTitle"), items: [t("payment1"), t("payment2"), t("payment3")] },
    { title: t("changesTitle"), items: [t("changes1")] },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8">
      <Link href="/" className="inline-block rounded-md">
        <Logo />
      </Link>
      <main id="main" className="py-12">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <ReefLine className="mt-3 mb-5" />
        <p className="text-lg text-muted-foreground">{t("intro", { app })}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("updated", { date: format.dateTime(new Date(billingConfig.termsVersion), { dateStyle: "long" }) })}
        </p>
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
