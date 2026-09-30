"use client";

import { CalendarCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { subjectStyle, type SubjectId } from "@/config/subjects";
import { cn } from "@/lib/utils";

/** Revision sidebar: today's review, then one link per subject with its due cards. */
export function RevisionNav({ subjects, due }: { subjects: { id: SubjectId; due: number }[]; due: number }) {
  const t = useTranslations("revision");
  const ts = useTranslations("subjects");
  const pathname = usePathname();
  const sorted = [...subjects].sort((a, b) => ts(a.id).localeCompare(ts(b.id)));

  const item = (active: boolean) =>
    cn(
      "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
      active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
    );

  return (
    <nav aria-label={t("subjectsNav")} className="space-y-6">
      <Link
        href="/revision"
        aria-current={pathname === "/revision" || pathname === "/revision/review" ? "page" : undefined}
        className={item(pathname === "/revision" || pathname === "/revision/review")}
      >
        <CalendarCheck className="size-4 text-primary" aria-hidden="true" />
        <span className="flex-1">{t("today")}</span>
        {due > 0 && <DueBadge count={due} label={t("dueCount", { count: due })} />}
      </Link>

      <div>
        <p className="mb-2 px-3 text-xs font-bold tracking-wide text-muted-foreground uppercase">{t("yourSubjects")}</p>
        <ul className="space-y-0.5">
          {sorted.map((s) => {
            const href = `/revision/${s.id}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={s.id} style={subjectStyle(s.id)}>
                <Link href={href} aria-current={active ? "page" : undefined} className={item(active)}>
                  <span className="bg-subject size-2.5 shrink-0 rounded-full" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{ts(s.id)}</span>
                  {s.due > 0 && <DueBadge count={s.due} label={t("dueCount", { count: s.due })} />}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

export function DueBadge({ count, label, className }: { count: number; label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-2xs font-bold text-primary-foreground tabular-nums",
        className,
      )}
    >
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
