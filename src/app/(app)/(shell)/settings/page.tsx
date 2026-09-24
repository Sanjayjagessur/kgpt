import { Settings } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("settings") };
}

export default async function Page() {
  const t = await getTranslations("nav");
  const tc = await getTranslations("common");
  return (
    <>
      <PageHeader title={t("settings")} />
      <EmptyState icon={Settings} title={tc("comingSoon")} body={tc("comingSoonBody")} />
    </>
  );
}
