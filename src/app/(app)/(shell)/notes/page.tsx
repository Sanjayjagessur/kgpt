import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { BookmarkList } from "@/components/notes/bookmark-list";
import { NotesList } from "@/components/notes/notes-list";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createNote } from "@/server/actions/notes";
import { listBookmarks, listNotes } from "@/server/notes";
import { requireStudent } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("notes") };
}

export default async function NotesPage(props: PageProps<"/notes">) {
  const student = await requireStudent();
  const { view, error } = await props.searchParams;
  const showBookmarks = view === "bookmarks";
  const [t, tn, tl, locale] = await Promise.all([
    getTranslations("notes"),
    getTranslations("nav"),
    getTranslations("learn"),
    getLocale(),
  ]);

  const views = [
    { key: "notes", href: "/notes", label: t("tabNotes"), active: !showBookmarks },
    { key: "bookmarks", href: "/notes?view=bookmarks", label: t("tabBookmarks"), active: showBookmarks },
  ];

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={tn("notes")}
        description={t("subtitle")}
        actions={
          <form action={createNote}>
            <Button type="submit">
              <Plus aria-hidden="true" />
              {t("newNote")}
            </Button>
          </form>
        }
      />

      {error === "create" && (
        <p role="alert" className="mb-4 text-sm font-medium text-destructive">
          {t("createFailed")}
        </p>
      )}

      <nav aria-label={t("viewsLabel")} className="mb-6">
        <ul className="inline-flex gap-1 rounded-xl bg-sunken p-1">
          {views.map((v) => (
            <li key={v.key}>
              <Link
                href={v.href}
                aria-current={v.active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center rounded-lg px-4 text-sm font-semibold transition-colors",
                  v.active ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {showBookmarks ? (
        <BookmarkList items={await listBookmarks(locale, (n) => tl("unitLabel", { number: n }))} />
      ) : (
        <NotesList notes={await listNotes()} subjects={student.subjects} />
      )}
    </div>
  );
}
