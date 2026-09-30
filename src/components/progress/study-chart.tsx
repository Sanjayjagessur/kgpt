import { getFormatter, getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { formatDuration } from "./duration";

/**
 * Minutes studied per day as bars (one series, so no legend). Each bar has a
 * hover tooltip; a visually hidden table carries the same numbers for screen readers.
 */
export async function StudyChart({ days, today }: { days: { day: string; seconds: number }[]; today: string }) {
  const [t, format] = await Promise.all([getTranslations("progress"), getFormatter()]);
  const max = Math.max(...days.map((d) => d.seconds), 60 * 30);
  const dateOf = (day: string) => new Date(`${day}T12:00:00Z`);

  return (
    <figure className="m-0">
      <div aria-hidden="true" className="relative">
        {/* Recessive guide at the top of the scale. */}
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-border" />
        <span className="absolute -top-2.5 right-0 bg-card pl-1 text-2xs font-semibold text-muted-foreground">
          {formatDuration(t, max)}
        </span>
        <ol className="flex h-36 items-end gap-0.5 border-b border-border pt-4 sm:gap-1">
          {days.map((d) => {
            const height = d.seconds ? Math.max((d.seconds / max) * 100, 3) : 0;
            return (
              <li key={d.day} className="group relative flex h-full flex-1 items-end justify-center">
                <span
                  className={cn(
                    "w-full max-w-7 rounded-t-[4px] transition-opacity",
                    d.day === today ? "bg-primary" : "bg-primary/70",
                    "group-hover:opacity-80",
                  )}
                  style={{ height: `${height}%` }}
                />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-2xs font-semibold whitespace-nowrap text-background shadow-md group-hover:block">
                  {format.dateTime(dateOf(d.day), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}
                  {": "}
                  {formatDuration(t, d.seconds)}
                </span>
              </li>
            );
          })}
        </ol>
        <ol className="mt-1.5 flex gap-0.5 sm:gap-1">
          {days.map((d) => (
            <li
              key={d.day}
              className={cn(
                "flex-1 text-center text-2xs",
                d.day === today ? "font-bold text-foreground" : "text-muted-foreground",
              )}
            >
              {format.dateTime(dateOf(d.day), { weekday: "narrow", timeZone: "UTC" })}
            </li>
          ))}
        </ol>
      </div>
      <table className="sr-only">
        <caption>{t("chartCaption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("day")}</th>
            <th scope="col">{t("timeStudied")}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th scope="row">
                {format.dateTime(dateOf(d.day), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
              </th>
              <td>{formatDuration(t, d.seconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
