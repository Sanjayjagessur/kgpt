import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ReefLine } from "@/components/common/reef-line";
import { ContinueCard } from "@/components/learning/continue-card";
import { StreakWeek } from "@/components/learning/streak-week";
import { SubjectGrid } from "@/components/learning/subject-grid";
import { createClient } from "@/lib/supabase/server";
import { addDays, currentStreak, isoDay, weekDays } from "@/lib/streak";
import { getContinueLesson, getSubjectSummaries } from "@/server/learning";
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
  const tc = await getTranslations("common");

  const now = new Date();
  const today = isoDay(now);
  const supabase = await createClient();
  const [{ data: days }, summaries, continueLesson] = await Promise.all([
    supabase
      .from("study_days")
      .select("day")
      .eq("user_id", student.id)
      .gte("day", addDays(today, -120))
      .gt("seconds", 0),
    getSubjectSummaries(student),
    getContinueLesson(student),
  ]);
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

      <ContinueCard lesson={continueLesson} />

      <SubjectGrid subjects={summaries} />
    </div>
  );
}
