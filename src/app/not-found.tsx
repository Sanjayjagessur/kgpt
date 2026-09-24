import { Compass } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { Logo } from "@/components/common/logo";
import { ButtonLink } from "@/components/ui/button-link";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <Logo />
      <main id="main" className="pt-16">
        <EmptyState
          icon={Compass}
          title={t("notFound")}
          body={t("notFoundBody")}
          action={
            <ButtonLink href="/learn">
              {t("goToLearning")}
            </ButtonLink>
          }
        />
      </main>
    </div>
  );
}
