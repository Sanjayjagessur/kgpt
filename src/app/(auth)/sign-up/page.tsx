import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/components/auth/auth-form";
import { ReefLine } from "@/components/common/reef-line";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signUpTitle") };
}

export default async function Page() {
  const t = await getTranslations("auth");
  return (
    <>
      <h1 className="text-3xl font-extrabold">{t("signUpTitle")}</h1>
      <ReefLine className="mt-3 mb-4" />
      <p className="mb-8 text-muted-foreground">{t("signUpBody")}</p>
      <AuthForm mode="sign-up" />
      <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
        {t("privacyNote")}{" "}
        <Link href="/privacy" className="font-semibold text-foreground underline underline-offset-4">
          {t("privacyLink")}
        </Link>
      </p>
    </>
  );
}
