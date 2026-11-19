import { CircleCheck, LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ParentCheckout } from "@/components/billing/parent-checkout";
import { Logo } from "@/components/common/logo";
import { ReefLine } from "@/components/common/reef-line";
import { siteConfig } from "@/config/site";
import { lookupInvite } from "@/server/billing/invites";
import { paddleCheckoutConfig } from "@/server/billing/paddle";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing.parent");
  // The student's name stays out of the tab title and link previews.
  return { title: t("titleNoName"), robots: { index: false, follow: false } };
}

/** Public page a parent opens from the student's link: permission, then Paddle checkout. */
export default async function ParentPage({ params }: PageProps<"/parent/[token]">) {
  const { token } = await params;
  const [t, locale, invite] = await Promise.all([getTranslations("billing.parent"), getLocale(), lookupInvite(token)]);
  const app = siteConfig.name;

  let body: React.ReactNode;
  if (invite.state === "invalid" || invite.state === "expired") {
    body = (
      <Notice
        icon={<LinkIcon className="size-6" aria-hidden="true" />}
        title={invite.state === "expired" ? t("expiredTitle") : t("invalidTitle")}
        text={t("invalidBody", { app })}
      />
    );
  } else if (invite.state === "paid") {
    body = <Notice icon={<CircleCheck className="size-6" aria-hidden="true" />} title={t("paidTitle")} text={t("paidBody")} />;
  } else {
    const name = invite.studentName;
    const config = paddleCheckoutConfig();
    body = (
      <>
        <h1 className="text-3xl font-extrabold tracking-[-0.025em]">
          {name ? t("title", { name }) : t("titleNoName")}
        </h1>
        <ReefLine className="mt-3 mb-5" />
        <p className="text-lg text-muted-foreground">{t("intro", { app })}</p>

        <h2 className="mt-8 text-lg font-bold">{t("includesTitle")}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-primary">
          <li>{t("includes1")}</li>
          <li>{t("includes2")}</li>
          <li>{t("includes3")}</li>
        </ul>

        {config ? (
          <ParentCheckout token={token} studentName={name} config={config} checkoutLocale={locale === "fr" ? "fr" : "en"} />
        ) : (
          <p role="alert" className="mt-10 rounded-lg bg-sunken p-4 text-sm">
            {t("notConfigured")}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8">
      <Link href="/" className="inline-block rounded-md">
        <Logo />
      </Link>
      <main id="main" className="py-10">
        {body}
      </main>
    </div>
  );
}

function Notice({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        {icon}
      </span>
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="mt-2 max-w-[44ch] text-muted-foreground">{text}</p>
    </div>
  );
}
