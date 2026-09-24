/** Date helpers pinned to Mauritius time so "today" matches the student's day. */
const TZ = "Indian/Mauritius";

export function isoDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Monday-first week containing `today`, as ISO dates. */
export function weekDays(today: string): string[] {
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // Mon = 0
  const monday = addDays(today, -dow);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * Consecutive days studied ending today, or ending yesterday if today has
 * no activity yet (the streak is still alive until the day ends).
 */
export function currentStreak(studied: Set<string>, today: string): number {
  let cursor = studied.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (studied.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export { addDays };
