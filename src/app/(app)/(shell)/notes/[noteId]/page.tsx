import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Breadcrumbs } from "@/components/learning/breadcrumbs";
import { ReefLine } from "@/components/common/reef-line";
import { NoteEditor } from "@/components/notes/note-editor";
import { getNote } from "@/server/notes";
import { requireStudent } from "@/server/session";

async function load(props: PageProps<"/notes/[noteId]">) {
  const { noteId } = await props.params;
  if (!z.uuid().safeParse(noteId).success) notFound();
  const student = await requireStudent();
  const note = await getNote(noteId);
  if (!note) notFound();
  return { student, note };
}

export async function generateMetadata(props: PageProps<"/notes/[noteId]">): Promise<Metadata> {
  const { note } = await load(props);
  const t = await getTranslations("notes");
  return { title: note.title || t("untitled") };
}

export default async function NotePage(props: PageProps<"/notes/[noteId]">) {
  const { student, note } = await load(props);
  const { new: isNew } = await props.searchParams;
  const [t, tn] = await Promise.all([getTranslations("notes"), getTranslations("nav")]);

  return (
    <div className="max-w-3xl">
      <Breadcrumbs items={[{ href: "/notes", label: tn("notes") }, { label: note.title || t("untitled") }]} />
      <h1 className="sr-only">{note.title || t("untitled")}</h1>
      <ReefLine className="mb-6" />
      {/* Subjects no longer taken stay selectable so an old note keeps its subject. */}
      <NoteEditor
        note={note}
        isNew={isNew === "1"}
        subjects={note.subjectId && !student.subjects.includes(note.subjectId) ? [...student.subjects, note.subjectId] : student.subjects}
      />
    </div>
  );
}
