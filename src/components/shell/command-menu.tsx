"use client";

import { NotebookPen, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
import { MOBILE_NAV } from "./nav-items";

type Ctx = { open: boolean; setOpen: (open: boolean) => void };
const CommandMenuContext = createContext<Ctx>({ open: false, setOpen: () => {} });

export function useCommandMenu() {
  return useContext(CommandMenuContext);
}

/**
 * Global search (Ctrl/Cmd+K). Phase 1 covers pages and the student's subjects;
 * units, lessons, notes and chats are added in phase 5.
 */
export function CommandMenuProvider({ subjects, children }: { subjects: SubjectId[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("nav");
  const ts = useTranslations("subjects");
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

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const value = useMemo(() => ({ open, setOpen }), [open]);

  return (
    <CommandMenuContext.Provider value={value}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen} title={t("search")} description={t("commandPlaceholder")}>
        <Command>
          <CommandInput placeholder={t("commandPlaceholder")} />
          <CommandList>
            <CommandEmpty>{t("commandEmpty")}</CommandEmpty>
            <CommandGroup heading={t("pages")}>
              {MOBILE_NAV.map((item) => (
                <CommandItem key={item.href} value={t(item.key)} onSelect={() => go(item.href)}>
                  <item.icon aria-hidden="true" />
                  {t(item.key)}
                </CommandItem>
              ))}
              <CommandItem value={t("notes")} onSelect={() => go("/notes")}>
                <NotebookPen aria-hidden="true" />
                {t("notes")}
              </CommandItem>
              <CommandItem value={t("settings")} onSelect={() => go("/settings")}>
                <Settings aria-hidden="true" />
                {t("settings")}
              </CommandItem>
            </CommandGroup>
            {subjects.length > 0 && (
              <CommandGroup heading={t("yourSubjects")}>
                {subjects.map((id) => (
                  <CommandItem key={id} value={ts(id)} onSelect={() => go(`/learn/${id}`)}>
                    <span
                      style={subjectStyle(id)}
                      className="bg-subject-tint flex size-6 items-center justify-center rounded"
                    >
                      <SubjectArt subject={id} className="w-5" />
                    </span>
                    {ts(id)}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </CommandMenuContext.Provider>
  );
}
