"use client";

import { MessagesSquare, NotebookPen, Search, X } from "lucide-react";
import Link from "next/link";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { subjectStyle, type SubjectId } from "@/config/subjects";
import type { NoteSummary } from "@/server/notes";

const ALL = "all";
const NONE = "none";

/** The student's notes with search (title and text) and a subject filter. */
export function NotesList({ notes, subjects }: { notes: NoteSummary[]; subjects: SubjectId[] }) {
  const t = useTranslations("notes");
  const ts = useTranslations("subjects");
  const format = useFormatter();
  const now = useNow();
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<string>(ALL);
  const searchId = useId();
  const subjectId = useId();

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return notes.filter((n) => {
      if (subject === NONE ? n.subjectId !== null : subject !== ALL && n.subjectId !== subject) return false;
      return !q || n.title.toLocaleLowerCase().includes(q) || n.excerpt.toLocaleLowerCase().includes(q);
    });
  }, [notes, query, subject]);

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
        <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <NotebookPen className="size-6" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-bold">{t("emptyTitle")}</h2>
        <p className="mt-1 max-w-[44ch] text-sm text-muted-foreground">{t("emptyBody")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor={searchId} className="sr-only">
            {t("search")}
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            className="pr-10 pl-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
              <span className="sr-only">{t("clearSearch")}</span>
            </button>
          )}
        </div>
        <label htmlFor={subjectId} className="sr-only">
          {t("filterSubject")}
        </label>
        <select
          id={subjectId}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-semibold outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-56"
        >
          <option value={ALL}>{t("allSubjects")}</option>
          {subjects.map((id) => (
            <option key={id} value={id}>
              {ts(id)}
            </option>
          ))}
          <option value={NONE}>{t("noSubject")}</option>
        </select>
      </div>

      <p className="sr-only" aria-live="polite">
        {t("resultsCount", { count: visible.length })}
      </p>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t("noMatches")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((n) => (
            <li key={n.id} style={n.subjectId ? subjectStyle(n.subjectId) : undefined}>
              <Link
                href={`/notes/${n.id}`}
                className="flex h-full flex-col rounded-xl bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  {n.subjectId && (
                    <>
                      <span className="bg-subject size-2 shrink-0 rounded-full" aria-hidden="true" />
                      <span className="text-subject-ink truncate">{ts(n.subjectId)}</span>
                      <span aria-hidden="true">·</span>
                    </>
                  )}
                  <span className="shrink-0">{format.relativeTime(new Date(n.updatedAt), now)}</span>
                  {n.fromChat && (
                    <span className="ml-auto inline-flex shrink-0 items-center gap-1">
                      <MessagesSquare className="size-3.5" aria-hidden="true" />
                      {t("fromChat")}
                    </span>
                  )}
                </span>
                <span className="mt-1.5 line-clamp-1 font-bold">{n.title || t("untitled")}</span>
                <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.excerpt || t("emptyNote")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
