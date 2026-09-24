import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ReefLine } from "@/components/common/reef-line";
import { SubjectArt } from "@/components/common/subject-art";
import { StreakWeek } from "@/components/learning/streak-week";
import { subjectStyle } from "@/config/subjects";
import { createClient } from "@/lib/supabase/server";
import { addDays, currentStreak, isoDay, weekDays } from "@/lib/streak";
import { requireStudent } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("learning") };
}

function greetingKey(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Indian/Mauritius" }).format(now),
  );
  if (hour < 12) return "greetingMorning" as const;
  if (hour < 18) return "greetingAfternoon" as const;
  return "greetingEvening" as const;
}

export default async function LearnPage() {
  const student = await requireStudent();
  const t = await getTranslations("home");
  const ts = await getTranslations("subjects");
  const tc = await getTranslations("common");
  const tn = await getTranslations("nav");

  const now = new Date();
  const today = isoDay(now);
  const supabase = await createClient();
  const { data: days } = await supabase
    .from("study_days")
    .select("day")
    .eq("user_id", student.id)
    .gte("day", addDays(today, -120))
    .gt("seconds", 0);
  const studied = new Set((days ?? []).map((d) => d.day));

  return (
    <div className="space-y-10">
      <section className="grid gap-6 lg:grid-cols-[1fr_minmax(0,24rem)] lg:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold text-muted-foreground">
            {tc("grade", { grade: student.profile.grade })}
          </p>
          <h1 className="text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">
            {t(greetingKey(now), { name: student.profile.display_name ?? "" })}
          </h1>
          <ReefLine className="mt-4 mb-3 w-44" />
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <StreakWeek days={weekDays(today)} studied={studied} today={today} streak={currentStreak(studied, today)} />
      </section>

      <section aria-labelledby="subjects-title">
        <h2 id="subjects-title" className="mb-4 text-xl font-bold">
          {tn("yourSubjects")}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {student.subjects.map((id) => (
            <li key={id} style={subjectStyle(id)}>
              <Link
                href={`/learn/${id}`}
                className="bg-subject-tint group flex h-full flex-col rounded-xl p-3 transition-transform duration-200 ease-out-soft hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:transform-none sm:p-4"
              >
                <SubjectArt
                  subject={id}
                  className="mb-3 w-full transition-transform duration-300 ease-out-soft group-hover:scale-[1.04] motion-reduce:transform-none"
                />
                <span className="text-subject-ink text-sm font-bold sm:text-base">{ts(id)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
