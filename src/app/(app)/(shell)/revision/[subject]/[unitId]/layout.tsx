import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { ReefLine } from "@/components/common/reef-line";
import { Breadcrumbs } from "@/components/learning/breadcrumbs";
import { UnitTabs } from "@/components/revision/unit-tabs";
import { subjectStyle } from "@/config/subjects";
import { localized } from "@/lib/supabase/database.types";
import { getRevisionUnit } from "@/server/revision";
import { requireStudent } from "@/server/session";

export default async function RevisionUnitLayout(props: LayoutProps<"/revision/[subject]/[unitId]">) {
  const { subject, unitId } = await props.params;
  if (!z.uuid().safeParse(unitId).success) notFound();
  const student = await requireStudent();
  const unit = await getRevisionUnit(student, unitId);
  if (!unit || unit.subject_id !== subject) notFound();

  const [tl, ts, tn, locale] = await Promise.all([
    getTranslations("learn"),
    getTranslations("subjects"),
    getTranslations("nav"),
    getLocale(),
  ]);

  return (
    <div style={subjectStyle(unit.subject_id)} className="max-w-3xl">
      <Breadcrumbs
        items={[
          { href: "/revision", label: tn("revision") },
          { href: `/revision/${unit.subject_id}`, label: ts(unit.subject_id) },
          { label: tl("unitLabel", { number: unit.position }) },
        ]}
      />
      <p className="text-subject-ink text-sm font-bold">{tl("unitLabel", { number: unit.position })}</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.025em] sm:text-4xl">{localized(unit.title, locale)}</h1>
      <ReefLine className="text-subject mt-3 mb-6" />
      <UnitTabs subjectId={unit.subject_id} unitId={unit.id} />
      <div className="mt-8">{props.children}</div>
    </div>
  );
}
