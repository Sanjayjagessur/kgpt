import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Logo } from "@/components/common/logo";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getStudent } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("nameTitle") };
}

export default async function OnboardingPage() {
  const student = await getStudent();
  const locale = await getLocale();
  const p = student?.profile;

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pt-5 sm:px-8">
      <Logo />
      <main id="main" className="flex flex-1 flex-col pt-8 sm:pt-14">
        <OnboardingFlow
          initial={{
            displayName: p?.display_name ?? "",
            grade: p?.grade ?? null,
            subjects: student?.subjects ?? [],
            uiLocale: p?.ui_locale ?? locale,
            tutorLocale: p?.tutor_locale ?? locale,
          }}
        />
      </main>
    </div>
  );
}
