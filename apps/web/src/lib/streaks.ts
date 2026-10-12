/** Pure streak math. Dates are local calendar dates as "YYYY-MM-DD" strings. */

export type StreakState = {
  current: number;
  longest: number;
  lastActiveDate: string | null;
  freezesAvailable: number;
  /** ISO week ("2026-W41") in which the freeze allowance was last refilled. */
  freezeWeek: string | null;
};

export const WEEKLY_FREEZES = 1;

/** Local calendar date for `now` in an IANA timezone (falls back to UTC). */
export function localDateString(now: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

function toUtcMs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000);
}

/** ISO 8601 week label, e.g. "2026-W41". */
export function isoWeek(date: string): string {
  const d = new Date(toUtcMs(date));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // nearest Thursday
  const year = d.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export const INITIAL_STREAK: StreakState = {
  current: 0,
  longest: 0,
  lastActiveDate: null,
  freezesAvailable: WEEKLY_FREEZES,
  freezeWeek: null,
};

/**
 * Registers activity on `today`.
 * - same day: streak unchanged
 * - yesterday: +1
 * - exactly one missed day and a freeze available: consume the freeze, +1
 * - anything else: reset to 1
 * The freeze allowance refills to 1 at the start of each ISO week.
 */
export function updateStreak(state: StreakState, today: string): StreakState {
  let { freezesAvailable, freezeWeek } = state;
  const week = isoWeek(today);
  if (freezeWeek !== week) {
    freezesAvailable = WEEKLY_FREEZES;
    freezeWeek = week;
  }

  let current: number;
  if (!state.lastActiveDate) {
    current = 1;
  } else {
    const gap = daysBetween(state.lastActiveDate, today);
    if (gap <= 0) {
      current = Math.max(state.current, 1); // same day (or clock skew): no change
    } else if (gap === 1) {
      current = state.current + 1;
    } else if (gap === 2 && freezesAvailable > 0) {
      freezesAvailable -= 1;
      current = state.current + 1;
    } else {
      current = 1;
    }
  }

  const lastActiveDate =
    state.lastActiveDate && daysBetween(state.lastActiveDate, today) < 0 ? state.lastActiveDate : today;
  return { current, longest: Math.max(state.longest, current), lastActiveDate, freezesAvailable, freezeWeek };
}
