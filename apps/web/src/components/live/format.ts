import { calendarDate, wallClock } from "@/lib/slots";

/** Pure display helpers shared by server and client live components (explicit tz and locale, so output is stable). */

export function fmtTime(d: Date | string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

export function fmtDay(d: Date | string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone, weekday: "long", day: "numeric", month: "long" }).format(new Date(d));
}

export function fmtDateTime(d: Date | string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

/** Local calendar day key used to group sessions by day. */
export function dayKey(d: Date | string, timeZone: string): string {
  return calendarDate(new Date(d), timeZone);
}

/** "yyyy-MM-ddTHH:mm" wall time of an instant in a timezone (the DatePicker withTime format). */
export function toLocalInput(d: Date | string, timeZone: string): string {
  const w = wallClock(new Date(d), timeZone);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${w.year}-${p(w.month)}-${p(w.day)}T${p(w.hour)}:${p(w.minute)}`;
}
