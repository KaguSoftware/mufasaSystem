/**
 * Pure 1:1 booking slot math. Weekly availability is stored as local "HH:mm"
 * ranges in the TUTOR's timezone; everything here converts to absolute instants
 * with Intl only (no date library), including DST gaps and overlaps.
 */

export type WeeklyRange = { day: 0 | 1 | 2 | 3 | 4 | 5 | 6; start: string; end: string };
export type Interval = { start: Date; end: Date };
export type Slot = { startsAt: Date; endsAt: Date };

export const SLOT_MINUTES = 30;
const MIN = 60_000;

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string) {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dtfCache.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Wall clock fields of an instant in a timezone. */
export function wallClock(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Offset (ms) such that local wall time = UTC + offset, at `instant`. */
export function tzOffsetMs(instant: Date, timeZone: string): number {
  const w = wallClock(instant, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Converts a wall clock time in `timeZone` to an instant. Returns null when that
 * wall time does not exist (spring-forward gap). For an ambiguous time (fall-back
 * overlap) the earlier instant is returned.
 */
export function zonedTimeToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  timeZone: string,
): Date | null {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const candidates = new Set<number>();
  for (const probe of [guess - 24 * 3600_000, guess + 24 * 3600_000, guess]) {
    candidates.add(guess - tzOffsetMs(new Date(probe), timeZone));
  }
  const valid = [...candidates]
    .filter((t) => {
      const w = wallClock(new Date(t), timeZone);
      return w.year === y && w.month === mo && w.day === d && w.hour === h && w.minute === mi;
    })
    .sort((a, b) => a - b);
  return valid.length ? new Date(valid[0]!) : null;
}

export function parseHm(hm: string): { h: number; m: number } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hm);
  return m ? { h: Number(m[1]), m: Number(m[2]) } : null;
}

/** Adds days to a "yyyy-MM-dd" calendar date (pure calendar math). */
export function addCalendarDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** Calendar date ("yyyy-MM-dd") of an instant in a timezone. */
export function calendarDate(instant: Date, timeZone: string): string {
  const w = wallClock(instant, timeZone);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

/** Validates ranges: well-formed times, end after start, no overlap within a day. */
export function validateWeekly(av: WeeklyRange[]): boolean {
  const byDay = new Map<number, [number, number][]>();
  for (const r of av) {
    const s = parseHm(r.start);
    const e = parseHm(r.end);
    if (!s || !e || r.day < 0 || r.day > 6) return false;
    const a = s.h * 60 + s.m;
    const b = e.h * 60 + e.m;
    if (b <= a) return false;
    const list = byDay.get(r.day) ?? [];
    for (const [x, y] of list) if (a < y && x < b) return false;
    list.push([a, b]);
    byDay.set(r.day, list);
  }
  return true;
}

/** Absolute intervals for the weekly template across `days` calendar days starting at `fromDate` (tutor-local). */
export function expandWeekly(av: WeeklyRange[], timeZone: string, fromDate: string, days: number): Interval[] {
  const out: Interval[] = [];
  for (let i = 0; i < days; i++) {
    const date = addCalendarDays(fromDate, i);
    const [y, mo, d] = date.split("-").map(Number);
    const weekday = new Date(Date.UTC(y!, mo! - 1, d!)).getUTCDay();
    for (const r of av) {
      if (r.day !== weekday) continue;
      const s = parseHm(r.start);
      const e = parseHm(r.end);
      if (!s || !e) continue;
      const start = zonedTimeToUtc(y!, mo!, d!, s.h, s.m, timeZone);
      const end = zonedTimeToUtc(y!, mo!, d!, e.h, e.m, timeZone);
      if (start && end && end > start) out.push({ start, end });
    }
  }
  return out;
}

export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = [...list].sort((a, b) => a.start.getTime() - b.start.getTime());
  const out: Interval[] = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv.start.getTime() <= last.end.getTime()) {
      if (iv.end > last.end) last.end = iv.end;
    } else out.push({ start: iv.start, end: iv.end });
  }
  return out;
}

export function subtractIntervals(base: Interval[], remove: Interval[]): Interval[] {
  const cuts = mergeIntervals(remove);
  const out: Interval[] = [];
  for (const b of mergeIntervals(base)) {
    let cursor = b.start.getTime();
    const end = b.end.getTime();
    for (const c of cuts) {
      const cs = c.start.getTime();
      const ce = c.end.getTime();
      if (ce <= cursor || cs >= end) continue;
      if (cs > cursor) out.push({ start: new Date(cursor), end: new Date(cs) });
      cursor = Math.max(cursor, ce);
      if (cursor >= end) break;
    }
    if (cursor < end) out.push({ start: new Date(cursor), end: new Date(end) });
  }
  return out;
}

export type SlotInput = {
  availability: WeeklyRange[];
  timeZone: string;
  /** Tutor-local calendar date "yyyy-MM-dd" of the first day. */
  fromDate: string;
  days: number;
  unavailable?: Interval[];
  extra?: Interval[];
  /** Existing sessions and active bookings. */
  busy?: Interval[];
  now?: Date;
  /** Slots starting sooner than this after `now` are hidden. */
  minLeadMin?: number;
  slotMin?: number;
};

/** Bookable slots (aligned to the slot length on the absolute clock), sorted by start. */
export function computeSlots(input: SlotInput): Slot[] {
  const slotMin = input.slotMin ?? SLOT_MINUTES;
  const step = slotMin * MIN;
  const now = input.now ?? new Date();
  const earliest = now.getTime() + (input.minLeadMin ?? 60) * MIN;
  const open = [...expandWeekly(input.availability, input.timeZone, input.fromDate, input.days), ...(input.extra ?? [])];
  const free = subtractIntervals(open, [...(input.unavailable ?? []), ...(input.busy ?? [])]);
  const slots: Slot[] = [];
  for (const iv of free) {
    let t = Math.ceil(iv.start.getTime() / step) * step;
    for (; t + step <= iv.end.getTime(); t += step) {
      if (t < earliest) continue;
      slots.push({ startsAt: new Date(t), endsAt: new Date(t + step) });
    }
  }
  return slots;
}

/** True when [startsAt, startsAt + durationMin) is fully covered by consecutive free slots. */
export function slotsCover(slots: Slot[], startsAt: Date, durationMin: number, slotMin = SLOT_MINUTES): boolean {
  if (durationMin <= 0 || durationMin % slotMin !== 0) return false;
  const have = new Set(slots.map((s) => s.startsAt.getTime()));
  for (let t = startsAt.getTime(); t < startsAt.getTime() + durationMin * MIN; t += slotMin * MIN) {
    if (!have.has(t)) return false;
  }
  return true;
}
