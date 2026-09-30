"use client";

import { BookOpen, Layers, MessagesSquare, NotebookPen, Settings, StickyNote } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useTransition } from "react";
import { SubjectArt } from "@/components/common/subject-art";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { subjectStyle, type SubjectId } from "@/config/subjects";
import { globalSearch, type SearchHit, type SearchResults } from "@/server/actions/search";
import { MOBILE_NAV } from "./nav-items";

type Ctx = { open: boolean; setOpen: (open: boolean) => void };
const CommandMenuContext = createContext<Ctx>({ open: false, setOpen: () => {} });

export function useCommandMenu() {
  return useContext(CommandMenuContext);
}

const MIN_QUERY = 2;

/**
 * Global search (Ctrl/Cmd+K): pages and subjects are matched in the browser;
 * units, lessons, notes and chats come from the server as the student types.
 */
export function CommandMenuProvider({ subjects, children }: { subjects: SubjectId[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ query: string; data: SearchResults } | null>(null);
  const [searching, startSearch] = useTransition();
  const t = useTranslations("nav");
  const ts = useTranslations("subjects");
  const tl = useTranslations("learn");
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const q = query.trim();
  useEffect(() => {
    if (q.length < MIN_QUERY) return;
    const timer = window.setTimeout(
      () => startSearch(async () => setResults({ query: q, data: await globalSearch(q) })),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [q]);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setResults(null);
    }
  }, []);

  const go = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [router, onOpenChange],
  );

  const value = useMemo(() => ({ open, setOpen }), [open]);

  const needle = q.toLocaleLowerCase();
  const matches = (label: string) => !needle || label.toLocaleLowerCase().includes(needle);
  const pages = [
    ...MOBILE_NAV.map((item) => ({ href: item.href, label: t(item.key), icon: item.icon })),
    { href: "/notes", label: t("notes"), icon: NotebookPen },
    { href: "/settings", label: t("settings"), icon: Settings },
  ].filter((p) => matches(p.label));
  const subjectMatches = subjects.filter((id) => matches(ts(id)));
  const server = q.length >= MIN_QUERY && results?.query === q ? results.data : null;
  const serverCount = server ? server.units.length + server.lessons.length + server.notes.length + server.chats.length : 0;
  const nothing = pages.length + subjectMatches.length + serverCount === 0;

  const hitGroup = (heading: string, hits: SearchHit[], Icon: typeof BookOpen, context: (h: SearchHit) => string) =>
    hits.length > 0 && (
      <CommandGroup heading={heading}>
        {hits.map((h) => (
          <CommandItem key={h.href} value={h.href} onSelect={() => go(h.href)}>
            <span
              style={h.subjectId ? subjectStyle(h.subjectId) : undefined}
              className="bg-subject-tint text-subject-ink flex size-6 shrink-0 items-center justify-center rounded"
            >
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{h.title}</span>
              {context(h) && <span className="block truncate text-xs text-muted-foreground">{context(h)}</span>}
            </span>
          </CommandItem>
        ))}
      </CommandGroup>
    );

  return (
    <CommandMenuContext.Provider value={value}>
      {children}
      <CommandDialog open={open} onOpenChange={onOpenChange} title={t("search")} description={t("commandPlaceholder")}>
        {/* Filtering is done here, so server results are never hidden by fuzzy matching. */}
        <Command shouldFilter={false}>
          <CommandInput placeholder={t("commandPlaceholder")} value={query} onValueChange={setQuery} />
          <CommandList>
            {nothing && !searching && <CommandEmpty>{t("commandEmpty")}</CommandEmpty>}
            {pages.length > 0 && (
              <CommandGroup heading={t("pages")}>
                {pages.map((p) => (
                  <CommandItem key={p.href} value={`page:${p.href}`} onSelect={() => go(p.href)}>
                    <p.icon aria-hidden="true" />
                    {p.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {subjectMatches.length > 0 && (
              <CommandGroup heading={t("yourSubjects")}>
                {subjectMatches.map((id) => (
                  <CommandItem key={id} value={`subject:${id}`} onSelect={() => go(`/learn/${id}`)}>
                    <span style={subjectStyle(id)} className="bg-subject-tint flex size-6 items-center justify-center rounded">
                      <SubjectArt subject={id} className="w-5" />
                    </span>
                    {ts(id)}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {server && (
              <>
                {hitGroup(t("searchUnits"), server.units, Layers, (h) =>
                  [h.subjectId ? ts(h.subjectId) : "", tl("unitLabel", { number: Number(h.context) })].filter(Boolean).join(" · "),
                )}
                {hitGroup(t("searchLessons"), server.lessons, BookOpen, (h) =>
                  [h.subjectId ? ts(h.subjectId) : "", h.context].filter(Boolean).join(" · "),
                )}
                {hitGroup(t("searchNotes"), server.notes.map((n) => ({ ...n, title: n.title || t("untitledNote") })), StickyNote, (h) => h.context)}
                {hitGroup(t("searchChats"), server.chats, MessagesSquare, (h) => (h.subjectId ? ts(h.subjectId) : ""))}
              </>
            )}
            {searching && (
              <p role="status" className="px-3 py-2 text-xs text-muted-foreground">
                {t("searching")}
              </p>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </CommandMenuContext.Provider>
  );
}
