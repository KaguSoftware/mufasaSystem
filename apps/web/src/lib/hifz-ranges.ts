/** Pure range and coverage math for the hifz tracker. */

export type AyahRange = { surah: number; from: number; to: number };
export type AyahCounts = Record<number, number>;

/** First ayah of each juz (1..30). Same table as packages/db/src/seed/quran.ts. */
export const JUZ_STARTS: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41],
  [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1], [25, 21], [27, 56],
  [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1],
];

export function juzOf(surah: number, ayah: number): number {
  let juz = 1;
  for (let i = 0; i < JUZ_STARTS.length; i++) {
    const [s, a] = JUZ_STARTS[i]!;
    if (surah > s || (surah === s && ayah >= a)) juz = i + 1;
  }
  return juz;
}

/** True when 1 <= from <= to <= ayahCount of the surah. */
export function isValidRange(r: AyahRange, counts: AyahCounts): boolean {
  const max = counts[r.surah];
  return (
    Number.isInteger(r.surah) &&
    Number.isInteger(r.from) &&
    Number.isInteger(r.to) &&
    max !== undefined &&
    r.from >= 1 &&
    r.from <= r.to &&
    r.to <= max
  );
}

/** Merges overlapping and adjacent ranges per surah. Result is sorted by surah then ayah. */
export function mergeRanges(ranges: AyahRange[]): AyahRange[] {
  const sorted = [...ranges].sort((a, b) => a.surah - b.surah || a.from - b.from || a.to - b.to);
  const out: AyahRange[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && last.surah === r.surah && r.from <= last.to + 1) {
      last.to = Math.max(last.to, r.to);
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

export function rangeSize(r: AyahRange): number {
  return r.to - r.from + 1;
}

export type SurahCoverage = { surah: number; memorized: number; total: number; percent: number };

/** Per-surah coverage, clamped to each surah's ayah count. Only surahs with coverage are returned. */
export function coverageBySurah(ranges: AyahRange[], counts: AyahCounts): SurahCoverage[] {
  const out: SurahCoverage[] = [];
  for (const r of mergeRanges(ranges)) {
    const total = counts[r.surah];
    if (!total) continue;
    const size = Math.max(0, Math.min(r.to, total) - Math.max(r.from, 1) + 1);
    const last = out[out.length - 1];
    if (last && last.surah === r.surah) last.memorized += size;
    else out.push({ surah: r.surah, memorized: size, total, percent: 0 });
  }
  for (const c of out) c.percent = Math.round((c.memorized / c.total) * 100);
  return out;
}

export function totalAyahs(counts: AyahCounts): number {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

export type JuzCoverage = { juz: number; memorized: number; total: number; percent: number };

/** Coverage for all 30 juz, from merged memorized ranges. */
export function coverageByJuz(ranges: AyahRange[], counts: AyahCounts): JuzCoverage[] {
  const out: JuzCoverage[] = Array.from({ length: 30 }, (_, i) => ({ juz: i + 1, memorized: 0, total: 0, percent: 0 }));
  for (const [s, n] of Object.entries(counts)) {
    const surah = Number(s);
    for (let a = 1; a <= n; a++) out[juzOf(surah, a) - 1]!.total++;
  }
  for (const r of mergeRanges(ranges)) {
    const max = counts[r.surah];
    if (!max) continue;
    for (let a = Math.max(1, r.from); a <= Math.min(r.to, max); a++) out[juzOf(r.surah, a) - 1]!.memorized++;
  }
  for (const j of out) j.percent = j.total ? Math.round((j.memorized / j.total) * 100) : 0;
  return out;
}

/** Monday 00:00 UTC of the week containing `d`. */
export function weekStart(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7; // Monday = 0
  x.setUTCDate(x.getUTCDate() - dow);
  return x;
}

/** Share of the weekly target reached, 0..100 (capped). */
export function weeklyPercent(done: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((done / target) * 100)));
}

export type PlanBounds = { fromSurah: number; fromAyah: number; toSurah: number; toAyah: number | null };

/** The ayah ranges a plan covers (whole surahs in between, open end = end of the last surah). */
export function planToRanges(plan: PlanBounds, counts: AyahCounts): AyahRange[] {
  const out: AyahRange[] = [];
  for (let s = plan.fromSurah; s <= plan.toSurah; s++) {
    const max = counts[s];
    if (!max) continue;
    const from = s === plan.fromSurah ? plan.fromAyah : 1;
    const to = s === plan.toSurah ? Math.min(plan.toAyah ?? max, max) : max;
    if (from <= to) out.push({ surah: s, from, to });
  }
  return out;
}

/** Number of ayahs that are in both range sets. */
export function intersectionSize(a: AyahRange[], b: AyahRange[]): number {
  const ma = mergeRanges(a);
  const mb = mergeRanges(b);
  let total = 0;
  for (const x of ma) {
    for (const y of mb) {
      if (x.surah !== y.surah) continue;
      const lo = Math.max(x.from, y.from);
      const hi = Math.min(x.to, y.to);
      if (hi >= lo) total += hi - lo + 1;
    }
  }
  return total;
}
