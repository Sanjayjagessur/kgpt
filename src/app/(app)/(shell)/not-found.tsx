import { Compass } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { ButtonLink } from "@/components/ui/button-link";

export default async function ShellNotFound() {
  const t = await getTranslations("common");
  return (
    <EmptyState
      icon={Compass}
      title={t("notFound")}
      body={t("notFoundBody")}
      action={<ButtonLink href="/learn">{t("goToLearning")}</ButtonLink>}
    />
  );
}
