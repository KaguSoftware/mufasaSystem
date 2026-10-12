import { addCalendarDays, zonedTimeToUtc } from "./slots";

/** Pure join-window rules for live sessions. */

export const JOIN_EARLY_MIN = 15;
export const AUTO_END_AFTER_MIN = 30;
export const TOKEN_TAIL_MIN = 15;
export const LATE_GRACE_MIN = 10;

const MIN = 60_000;

export function sessionEnd(startsAt: Date, durationMin: number): Date {
  return new Date(startsAt.getTime() + durationMin * MIN);
}

/** Learners (and tutors) may enter from 15 minutes before the start until the scheduled end. */
export function isWithinJoinWindow(startsAt: Date, durationMin: number, now = new Date()): boolean {
  const t = now.getTime();
  return t >= startsAt.getTime() - JOIN_EARLY_MIN * MIN && t <= sessionEnd(startsAt, durationMin).getTime();
}

export type WindowState = "too_early" | "open" | "closed";

export function windowState(startsAt: Date, durationMin: number, now = new Date()): WindowState {
  const t = now.getTime();
  if (t < startsAt.getTime() - JOIN_EARLY_MIN * MIN) return "too_early";
  if (t > sessionEnd(startsAt, durationMin).getTime()) return "closed";
  return "open";
}

/** Token lifetime in seconds: until the session end plus a tail, never below 5 minutes. */
export function tokenTtlSeconds(startsAt: Date, durationMin: number, now = new Date()): number {
  const until = sessionEnd(startsAt, durationMin).getTime() + TOKEN_TAIL_MIN * MIN;
  return Math.max(300, Math.ceil((until - now.getTime()) / 1000));
}

/** Parses "yyyy-MM-ddTHH:mm" as a wall time in `timeZone`; null when invalid or nonexistent (DST gap). */
export function localDateTimeToUtc(local: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  return zonedTimeToUtc(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), timeZone);
}

/**
 * Weekly recurrence that keeps the LOCAL wall time (so a 17:00 class stays at 17:00
 * across a DST change). Weeks whose wall time does not exist are skipped.
 */
export function recurringStarts(local: string, timeZone: string, weeks: number): Date[] {
  const n = Math.min(Math.max(Math.floor(weeks), 1), 52);
  const [date, time] = local.split("T") as [string, string];
  const out: Date[] = [];
  for (let i = 0; i < n; i++) {
    const d = localDateTimeToUtc(`${addCalendarDays(date, i * 7)}T${time}`, timeZone);
    if (d) out.push(d);
  }
  return out;
}

/** An external meeting link must be https. */
export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
