import { NotebookPen } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("notes") };
}

export default async function Page() {
  const t = await getTranslations("nav");
  const tc = await getTranslations("common");
  return (
    <>
      <PageHeader title={t("notes")} />
      <EmptyState icon={NotebookPen} title={tc("comingSoon")} body={tc("comingSoonBody")} />
    </>
  );
}
