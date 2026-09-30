"use client";

import { useTranslations } from "next-intl";
import { ContentPreparing } from "@/components/common/content-preparing";

/** Shown the first time anyone opens a lesson: asks the server to write it, then refreshes. */
export function LessonPreparing({ lessonId }: { lessonId: string }) {
  const t = useTranslations("learn");
  return (
    <ContentPreparing
      endpoint={`/api/lessons/${lessonId}/content`}
      title={t("preparing")}
      body={t("preparingBody")}
      errorTitle={t("preparingError")}
    />
  );
}
