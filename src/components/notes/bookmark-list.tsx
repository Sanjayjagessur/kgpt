"use client";

import { Bookmark, BookOpen, Layers, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { subjectStyle } from "@/config/subjects";
import { removeBookmark } from "@/server/actions/notes";
import type { BookmarkItem } from "@/server/notes";

export function BookmarkList({ items: initial }: { items: BookmarkItem[] }) {
  const t = useTranslations("notes");
  const ts = useTranslations("subjects");
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
        <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Bookmark className="size-6" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-bold">{t("noBookmarks")}</h2>
        <p className="mt-1 max-w-[44ch] text-sm text-muted-foreground">{t("noBookmarksBody")}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-xl bg-card shadow-sm">
      {items.map((b) => {
        const Icon = b.kind === "lesson" ? BookOpen : Layers;
        return (
          <li key={b.id} style={subjectStyle(b.subjectId)} className="flex items-center gap-2 pr-2">
            <Link href={b.href} className="flex min-w-0 flex-1 items-center gap-3 p-4 transition-colors hover:bg-muted/40">
              <span className="bg-subject-soft text-subject-ink flex size-9 shrink-0 items-center justify-center rounded-full">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{b.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {ts(b.subjectId)} · {b.context}
                </span>
              </span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              disabled={pending}
              aria-label={t("removeBookmark", { title: b.title })}
              onClick={() =>
                startTransition(async () => {
                  const res = await removeBookmark(b.id);
                  if (!res.ok) return void toast.error(t("bookmarkFailed"));
                  setItems((list) => list.filter((x) => x.id !== b.id));
                })
              }
            >
              <X aria-hidden="true" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
