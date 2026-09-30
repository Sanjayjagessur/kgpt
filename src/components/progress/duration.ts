type Translate = (key: "minutes" | "hoursMinutes", values: Record<string, number>) => string;

/** "25 min" or "1 h 5 min", rounded to whole minutes. */
export function formatDuration(t: Translate, seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t("minutes", { count: minutes });
  return t("hoursMinutes", { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}
