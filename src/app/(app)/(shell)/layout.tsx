import { getTranslations } from "next-intl/server";
import { TrialBanner } from "@/components/billing/trial-banner";
import { AppHeader } from "@/components/shell/app-header";
import { CommandMenuProvider } from "@/components/shell/command-menu";
import { MobileTabBar } from "@/components/shell/mobile-tab-bar";
import { StudyHeartbeat } from "@/components/shell/study-heartbeat";
import { requireStudent } from "@/server/session";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const student = await requireStudent();
  const t = await getTranslations("common");
  const name = student.profile.display_name ?? "";

  return (
    <CommandMenuProvider subjects={student.subjects}>
      <a
        href="#main"
        className="fixed top-2 left-2 z-50 -translate-y-16 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform focus:translate-y-0"
      >
        {t("skipToContent")}
      </a>
      <AppHeader name={name} />
      <TrialBanner />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 outline-none sm:px-6 sm:pt-10 md:pb-16">
        {children}
      </main>
      <MobileTabBar />
      <StudyHeartbeat />
    </CommandMenuProvider>
  );
}
