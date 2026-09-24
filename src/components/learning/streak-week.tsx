import { Flame } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

export async function StreakWeek({
  days,
  studied,
  today,
  streak,
}: {
  days: string[];
  studied: Set<string>;
  today: string;
  streak: number;
}) {
  const t = await getTranslations("streak");
  const format = await getFormatter();

  return (
    <section aria-labelledby="streak-title" className="rounded-xl bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="streak-title" className="text-sm font-bold text-muted-foreground">
          {t("title")}
        </h2>
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <Flame
            className={cn("size-5", streak > 0 ? "fill-flame/20 text-flame" : "text-muted-foreground")}
            aria-hidden="true"
          />
          {t("days", { count: streak })}
        </p>
      </div>
      <ol className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((day) => {
          const done = studied.has(day);
          const isToday = day === today;
          const date = new Date(`${day}T12:00:00Z`);
          const label = format.dateTime(date, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
          return (
            <li key={day} className="flex flex-col items-center gap-1.5">
              <span className="text-2xs font-semibold text-muted-foreground" aria-hidden="true">
                {format.dateTime(date, { weekday: "narrow", timeZone: "UTC" })}
              </span>
              <span
                className={cn(
                  "flex aspect-square w-full max-w-11 items-center justify-center rounded-full text-xs font-bold tabular-nums transition-colors",
                  done ? "bg-primary text-primary-foreground" : "bg-sunken text-muted-foreground",
                  isToday && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                )}
              >
                <span className="sr-only">
                  {label}, {done ? t("studied") : t("notStudied")}
                  {isToday ? `, ${t("today")}` : ""}
                </span>
                <span aria-hidden="true">{date.getUTCDate()}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
