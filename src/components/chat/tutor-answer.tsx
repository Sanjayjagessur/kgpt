"use client";

import { BookOpen, CircleHelp, KeyRound } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Markdown } from "@/components/common/markdown";
import { subjectStyle, type SubjectId } from "@/config/subjects";
import { splitCallouts } from "@/lib/callouts";
import type { UnitRef } from "@/lib/chat";
import { cn } from "@/lib/utils";

/**
 * A tutor reply: an optional chip naming the curriculum unit it belongs to,
 * then the answer with "Key idea" and "Check yourself" callouts drawn as cards.
 */
export function TutorAnswer({ content, unit, streaming }: { content: string; unit?: UnitRef | null; streaming?: boolean }) {
  const t = useTranslations("chat");
  const segments = useMemo(() => splitCallouts(content), [content]);
  const last = segments.length - 1;

  return (
    <div className="space-y-3">
      {unit && (
        <Link
          href={`/learn/${unit.subjectId}/${unit.id}`}
          style={subjectStyle(unit.subjectId as SubjectId)}
          className="bg-subject-soft text-subject-ink inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold hover:underline"
        >
          <BookOpen className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{t("unitChip", { grade: unit.grade, title: unit.title })}</span>
        </Link>
      )}
      {segments.map((segment, i) => {
        const caret = streaming && i === last ? "streaming-caret" : undefined;
        if (segment.kind === "markdown") {
          return (
            <Markdown key={i} className={caret}>
              {segment.text}
            </Markdown>
          );
        }
        const isKey = segment.kind === "key";
        const Icon = isKey ? KeyRound : CircleHelp;
        return (
          <aside
            key={i}
            aria-label={isKey ? t("keyIdea") : t("checkYourself")}
            className={cn(
              "rounded-lg border p-4",
              isKey ? "border-primary/25 bg-card" : "border-pollen/40 bg-pollen/10",
            )}
          >
            <p
              className={cn(
                "mb-1.5 flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase",
                isKey ? "text-primary" : "text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {isKey ? t("keyIdea") : t("checkYourself")}
            </p>
            <Markdown className={cn(isKey && "text-lg", caret)}>{segment.text}</Markdown>
          </aside>
        );
      })}
    </div>
  );
}
