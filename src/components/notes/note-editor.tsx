"use client";

import { Check, MessagesSquare, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { EquationInput } from "@/components/chat/equation-input";
import { Markdown } from "@/components/common/markdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SubjectId } from "@/config/subjects";
import { cn } from "@/lib/utils";
import { deleteNote, updateNote } from "@/server/actions/notes";

type Note = { id: string; title: string; body: string; subjectId: SubjectId | null; chatId: string | null };

/** Edit a note: title, subject, Markdown body with a preview. Ctrl/Cmd+S saves. */
export function NoteEditor({ note, subjects, isNew }: { note: Note; subjects: SubjectId[]; isNew: boolean }) {
  const t = useTranslations("notes");
  const ts = useTranslations("subjects");
  const tc = useTranslations("common");
  const router = useRouter();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [subjectId, setSubjectId] = useState<SubjectId | null>(note.subjectId);
  const [saved, setSaved] = useState({ title: note.title, body: note.body, subjectId: note.subjectId });
  const [tab, setTab] = useState<"write" | "preview">(isNew || !note.body ? "write" : "preview");
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const ids = { title: useId(), subject: useId(), body: useId() };

  const dirty = title !== saved.title || body !== saved.body || subjectId !== saved.subjectId;

  const save = useCallback(() => {
    if (!dirty || saving) return;
    startSave(async () => {
      const res = await updateNote({ id: note.id, title, body, subjectId });
      if (!res.ok) return void toast.error(t("saveFailed"));
      setSaved({ title, body, subjectId });
    });
  }, [dirty, saving, note.id, title, body, subjectId, t]);

  useEffect(() => {
    if (isNew) titleRef.current?.focus();
  }, [isNew]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function insertEquation(latex: string) {
    const el = bodyRef.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    const snippet = `$${latex}$`;
    setBody(body.slice(0, start) + snippet + body.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <div className="grid gap-1.5">
          <Label htmlFor={ids.title}>{t("titleLabel")}</Label>
          <Input
            ref={titleRef}
            id={ids.title}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            placeholder={t("untitled")}
            className="font-heading text-lg font-bold"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={ids.subject}>{t("subjectLabel")}</Label>
          <select
            id={ids.subject}
            value={subjectId ?? ""}
            onChange={(e) => setSubjectId((e.target.value || null) as SubjectId | null)}
            className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-semibold outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">{t("noSubject")}</option>
            {subjects.map((id) => (
              <option key={id} value={id}>
                {ts(id)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div role="group" aria-label={t("viewLabel")} className="flex gap-1 rounded-lg bg-sunken p-1">
            {(["write", "preview"] as const).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "h-9 rounded-md px-3 text-sm font-semibold transition-colors",
                  tab === key ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(key)}
              </button>
            ))}
          </div>
          {tab === "write" && <EquationInput onInsert={insertEquation} />}
        </div>
        {tab === "write" ? (
          <div>
            <label htmlFor={ids.body} className="sr-only">
              {t("bodyLabel")}
            </label>
            <Textarea
              ref={bodyRef}
              id={ids.body}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={40000}
              rows={16}
              placeholder={t("bodyPlaceholder")}
              aria-describedby={`${ids.body}-hint`}
              className="min-h-72"
            />
            <p id={`${ids.body}-hint`} className="mt-1.5 text-xs text-muted-foreground">
              {t("markdownHint")}
            </p>
          </div>
        ) : (
          <div className="min-h-72 rounded-xl bg-card p-4 shadow-sm sm:p-6">
            {body.trim() ? <Markdown>{body}</Markdown> : <p className="text-sm text-muted-foreground">{t("emptyNote")}</p>}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? tc("saving") : t("saveNote")}
        </Button>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {dirty ? (
            t("unsaved")
          ) : (
            <span className="inline-flex items-center gap-1">
              <Check className="size-4 text-success" aria-hidden="true" />
              {t("allSaved")}
            </span>
          )}
        </p>
        <span className="flex-1" />
        {note.chatId && (
          <Link
            href={`/chat/${note.chatId}`}
            className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <MessagesSquare className="size-4" aria-hidden="true" />
            {t("openChat")}
          </Link>
        )}
        <Dialog>
          <DialogTrigger render={<Button variant="ghost" className="text-destructive hover:text-destructive" />}>
            <Trash2 aria-hidden="true" />
            {t("delete")}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("deleteTitle")}</DialogTitle>
              <DialogDescription>{t("deleteBody")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>{tc("cancel")}</DialogClose>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={() =>
                  startDelete(async () => {
                    const res = await deleteNote(note.id);
                    if (!res.ok) return void toast.error(t("deleteFailed"));
                    setSaved({ title, body, subjectId });
                    router.push("/notes");
                  })
                }
              >
                {t("deleteConfirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

