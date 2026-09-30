"use client";

import { BookText, Layers, ListChecks, PenLine } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { revisionHref, REVISION_KINDS } from "@/lib/revision";
import { cn } from "@/lib/utils";

const ICONS = { summary: BookText, flashcards: Layers, quiz: ListChecks, exam: PenLine } as const;

/** Summary, flashcards, quiz and exam practice for one unit, as links (each is its own page). */
export function UnitTabs({ subjectId, unitId }: { subjectId: string; unitId: string }) {
  const t = useTranslations("revision");
  const pathname = usePathname();

  return (
    <nav aria-label={t("unitSections")} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max min-w-full gap-1 rounded-xl bg-sunken p-1">
        {REVISION_KINDS.map((kind) => {
          const href = revisionHref(subjectId, unitId, kind);
          const active = pathname === href;
          const Icon = ICONS[kind];
          return (
            <li key={kind} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition-colors",
                  active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", active && "text-subject")} aria-hidden="true" />
                {t(`tabs.${kind}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
