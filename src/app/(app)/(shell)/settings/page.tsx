import { LogOut, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/app/(auth)/actions";
import { PlanSection } from "@/components/billing/plan-section";
import { PageHeader } from "@/components/common/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { Button } from "@/components/ui/button";
import { isUiLocale, siteConfig, type TutorLocale } from "@/config/site";
import { requireStudent } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("settings") };
}

export default async function SettingsPage() {
  const student = await requireStudent();
  const [t, tn] = await Promise.all([getTranslations("settings"), getTranslations("nav")]);
  const { profile } = student;
  const tutorLocale = (siteConfig.tutorLocales as readonly string[]).includes(profile.tutor_locale)
    ? (profile.tutor_locale as TutorLocale)
    : "en";

  return (
    <div className="max-w-3xl">
      <PageHeader title={tn("settings")} />
      <SettingsForm
        initial={{
          displayName: profile.display_name ?? "",
          grade: profile.grade,
          subjects: student.subjects,
          uiLocale: isUiLocale(profile.ui_locale) ? profile.ui_locale : "en",
          tutorLocale,
        }}
      />

      <PlanSection />

      <section aria-labelledby="data-title" className="mt-10 rounded-xl border p-5">
        <h2 id="data-title" className="flex items-center gap-2 text-xl font-bold">
          <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
          {t("privacy")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("privacyBody")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t("deleteAccount")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/privacy"
            className="inline-flex h-10 items-center rounded-md px-3 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t("readPrivacy")}
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              <LogOut aria-hidden="true" />
              {tn("signOut")}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
