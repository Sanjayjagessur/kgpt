import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ReefLine } from "@/components/common/reef-line";
import { StreakWeek } from "@/components/learning/streak-week";
import { SubjectGrid } from "@/components/learning/subject-grid";
import { ExamCard } from "@/components/today/exam-card";
import { TodayPlan } from "@/components/today/today-plan";
import { createClient } from "@/lib/supabase/server";
import { addDays, currentStreak, isoDay, weekDays } from "@/lib/streak";
import { getSubjectSummaries } from "@/server/learning";
import { getTodayPlan } from "@/server/today";
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
  const [{ data: days }, summaries, plan] = await Promise.all([
    supabase
      .from("study_days")
      .select("day")
      .eq("user_id", student.id)
      .gte("day", addDays(today, -120))
      .gt("seconds", 0),
    getSubjectSummaries(student),
    getTodayPlan(student, today),
  ]);
  const studied = new Set((days ?? []).map((d) => d.day));
  // Grade 9 students sit the National Certificate of Education (NCE); others name their own exam.
  const suggestedExam = student.profile.grade === 9 ? t("examSuggestionGrade9") : "";

  return (
    <div className="space-y-10">
      <section>
        <p className="mb-2 text-sm font-semibold text-muted-foreground">
          {tc("grade", { grade: student.profile.grade })}
        </p>
        <h1 className="text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">
          {t(greetingKey(now), { name: student.profile.display_name ?? "" })}
        </h1>
        <ReefLine className="mt-4 mb-3 w-44" />
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        <TodayPlan plan={plan} />
        <div className="grid min-w-0 grid-cols-1 gap-6">
          <ExamCard exam={plan.nextExam} suggestedLabel={suggestedExam} today={today} />
          <StreakWeek days={weekDays(today)} studied={studied} today={today} streak={currentStreak(studied, today)} />
        </div>
      </div>

      <SubjectGrid subjects={summaries} />
    </div>
  );
}
