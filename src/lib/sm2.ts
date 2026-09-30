import { addDays } from "./streak";

/** How the student rated their recall. */
export const RATINGS = ["again", "hard", "good", "easy"] as const;
export type Rating = (typeof RATINGS)[number];

/** SM-2 quality (0–5) for each rating. */
const QUALITY: Record<Rating, number> = { again: 1, hard: 3, good: 4, easy: 5 };

export type CardState = { ease: number; intervalDays: number; repetitions: number };

/**
 * SM-2 scheduling (SuperMemo 2). A lapse resets the card to tomorrow; a
 * successful recall grows the interval by the card's ease factor.
 * `today` is an ISO date in Mauritius time.
 */
export function schedule(card: CardState, rating: Rating, today: string): CardState & { dueOn: string } {
  const q = QUALITY[rating];
  let { repetitions, intervalDays } = card;

  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) intervalDays = 1;
    else if (repetitions === 1) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * card.ease);
    repetitions += 1;
  }

  const ease = Math.max(1.3, Math.round((card.ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)) * 100) / 100);
  intervalDays = Math.min(Math.max(intervalDays, 1), 3650);
  return { ease, intervalDays, repetitions, dueOn: addDays(today, intervalDays) };
}
