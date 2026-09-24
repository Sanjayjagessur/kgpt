"use client";

import { CloudOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export default function ShellError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  return (
    <EmptyState
      icon={CloudOff}
      title={t("somethingWrong")}
      body={t("somethingWrongBody")}
      action={<Button onClick={reset}>{t("retry")}</Button>}
    />
  );
}
