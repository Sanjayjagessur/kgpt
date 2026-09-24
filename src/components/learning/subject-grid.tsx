"use client";

import { Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { SubjectArt } from "@/components/common/subject-art";
import { Input } from "@/components/ui/input";
import { subjectStyle, type SubjectId } from "@/config/subjects";
import { cn } from "@/lib/utils";
import { ProgressBar } from "./progress-bar";

export type SubjectCardData = {
  id: SubjectId;
  totalLessons: number;
  completedLessons: number;
  lastStudiedAt: string | null;
};

type Sort = "alpha" | "recent" | "progress";
const SORT_KEY = "mykpt.subjectSort";

const SORT_EVENT = "mykpt:subject-sort";

function readSort(): Sort {
  try {
    const v = localStorage.getItem(SORT_KEY);
    return v === "recent" || v === "progress" ? v : "alpha";
  } catch {
    return "alpha";
  }
}

function subscribeSort(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SORT_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SORT_EVENT, onChange);
  };
}

export function SubjectGrid({ subjects }: { subjects: SubjectCardData[] }) {
  const t = useTranslations("learn");
  const tn = useTranslations("nav");
  const ts = useTranslations("subjects");
  const [query, setQuery] = useState("");
  // Saved sort lives in browser storage; the server always renders A to Z.
  const savedSort = useSyncExternalStore(subscribeSort, readSort, () => "alpha" as Sort);
  const [unsavedSort, setUnsavedSort] = useState<Sort | null>(null);
  const sort = unsavedSort ?? savedSort;
  const searchId = useId();

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const pct = (s: SubjectCardData) => (s.totalLessons ? s.completedLessons / s.totalLessons : 0);
    return subjects
      .filter((s) => !q || ts(s.id).toLocaleLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === "recent") return (b.lastStudiedAt ?? "").localeCompare(a.lastStudiedAt ?? "");
        if (sort === "progress") return pct(b) - pct(a);
        return ts(a.id).localeCompare(ts(b.id));
      });
  }, [subjects, query, sort, ts]);

  function changeSort(next: Sort) {
    try {
      localStorage.setItem(SORT_KEY, next);
      setUnsavedSort(null);
      window.dispatchEvent(new Event(SORT_EVENT));
    } catch {
      // Storage unavailable (private mode): sort for this visit only.
      setUnsavedSort(next);
    }
  }

  const sorts: { value: Sort; label: string }[] = [
    { value: "alpha", label: t("sortAlpha") },
    { value: "recent", label: t("sortRecent") },
    { value: "progress", label: t("sortProgress") },
  ];

  return (
    <section aria-labelledby="subjects-title">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="subjects-title" className="text-xl font-bold">
          {tn("yourSubjects")}
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-64">
            <label htmlFor={searchId} className="sr-only">
              {t("searchSubjects")}
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchSubjects")}
              className="h-10 pl-9"
            />
          </div>
          <div role="radiogroup" aria-label={t("sortLabel")} className="flex rounded-md bg-sunken p-1">
            {sorts.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={sort === s.value}
                onClick={() => changeSort(s.value)}
                className={cn(
                  "h-8 flex-1 rounded-sm px-2.5 text-xs font-semibold whitespace-nowrap transition-colors sm:flex-none",
                  sort === s.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center" role="status">
          <p className="text-sm text-muted-foreground">{t("noSubjectsMatch", { query })}</p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-primary hover:underline"
          >
            <X className="size-4" aria-hidden="true" />
            {t("clearSearch")}
          </button>
        </div>
      ) : (
        <motion.ul layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <AnimatePresence initial={false}>
            {visible.map((s) => {
              const pct = s.totalLessons ? (s.completedLessons / s.totalLessons) * 100 : 0;
              return (
                <motion.li
                  key={s.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  style={subjectStyle(s.id)}
                >
                  <Link
                    href={`/learn/${s.id}`}
                    className="group bg-subject-tint flex h-full flex-col rounded-xl p-3 transition-transform duration-200 ease-out-soft hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:transform-none sm:p-4"
                  >
                    <SubjectArt
                      subject={s.id}
                      className="mb-2 w-full transition-transform duration-300 ease-out-soft group-hover:scale-[1.04] motion-reduce:transform-none"
                    />
                    <span className="text-subject-ink text-sm leading-snug font-bold sm:text-base">{ts(s.id)}</span>
                    <span className="mt-auto pt-3">
                      <ProgressBar value={pct} tone="subject" label={t("progressPercent", { percent: Math.round(pct) })} />
                      <span className="mt-1.5 block text-2xs font-semibold text-muted-foreground">
                        {s.totalLessons ? t("progressPercent", { percent: Math.round(pct) }) : t("lessonsCount", { count: 0 })}
                      </span>
                    </span>
                  </Link>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      )}
    </section>
  );
}
