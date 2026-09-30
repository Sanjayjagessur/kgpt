import { RevisionNav } from "@/components/revision/revision-nav";
import { isoDay } from "@/lib/streak";
import { getRevisionSubjects } from "@/server/revision";
import { requireStudent } from "@/server/session";

export default async function RevisionLayout({ children }: { children: React.ReactNode }) {
  const student = await requireStudent();
  const subjects = await getRevisionSubjects(student, isoDay(new Date()));
  const due = subjects.reduce((n, s) => n + s.due, 0);

  return (
    <div className="flex gap-10">
      <aside className="sticky top-[6.5rem] hidden max-h-[calc(100dvh-8rem)] w-60 shrink-0 self-start overflow-y-auto lg:block">
        <RevisionNav subjects={subjects} due={due} />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
