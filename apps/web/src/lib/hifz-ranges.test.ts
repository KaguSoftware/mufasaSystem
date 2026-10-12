import { describe, expect, it } from "vitest";
import {
  coverageByJuz,
  coverageBySurah,
  isValidRange,
  juzOf,
  mergeRanges,
  totalAyahs,
  weekStart,
  weeklyPercent,
} from "./hifz-ranges";

const counts = { 1: 7, 2: 286, 112: 4, 113: 5, 114: 6 };

describe("mergeRanges", () => {
  it("merges overlapping and adjacent ranges", () => {
    expect(
      mergeRanges([
        { surah: 2, from: 10, to: 20 },
        { surah: 2, from: 1, to: 5 },
        { surah: 2, from: 6, to: 12 },
        { surah: 1, from: 1, to: 3 },
      ]),
    ).toEqual([
      { surah: 1, from: 1, to: 3 },
      { surah: 2, from: 1, to: 20 },
    ]);
  });
  it("keeps separate surahs and gaps apart", () => {
    expect(
      mergeRanges([
        { surah: 2, from: 1, to: 2 },
        { surah: 2, from: 4, to: 5 },
      ]),
    ).toHaveLength(2);
  });
  it("does not mutate input", () => {
    const input = [{ surah: 1, from: 1, to: 2 }, { surah: 1, from: 2, to: 4 }];
    mergeRanges(input);
    expect(input[0]).toEqual({ surah: 1, from: 1, to: 2 });
  });
});

describe("coverageBySurah", () => {
  it("counts each ayah once even with overlapping entries", () => {
    const res = coverageBySurah(
      [
        { surah: 114, from: 1, to: 4 },
        { surah: 114, from: 3, to: 6 },
      ],
      counts,
    );
    expect(res).toEqual([{ surah: 114, memorized: 6, total: 6, percent: 100 }]);
  });
  it("clamps to the surah size", () => {
    expect(coverageBySurah([{ surah: 112, from: 1, to: 99 }], counts)[0]!.memorized).toBe(4);
  });
  it("rounds percent", () => {
    expect(coverageBySurah([{ surah: 1, from: 1, to: 3 }], counts)[0]!.percent).toBe(43);
  });
});

describe("isValidRange", () => {
  it("validates bounds", () => {
    expect(isValidRange({ surah: 1, from: 1, to: 7 }, counts)).toBe(true);
    expect(isValidRange({ surah: 1, from: 1, to: 8 }, counts)).toBe(false);
    expect(isValidRange({ surah: 1, from: 0, to: 3 }, counts)).toBe(false);
    expect(isValidRange({ surah: 1, from: 4, to: 3 }, counts)).toBe(false);
    expect(isValidRange({ surah: 99, from: 1, to: 1 }, counts)).toBe(false);
  });
});

describe("juz math", () => {
  it("finds the juz of an ayah", () => {
    expect(juzOf(1, 1)).toBe(1);
    expect(juzOf(2, 141)).toBe(1);
    expect(juzOf(2, 142)).toBe(2);
    expect(juzOf(78, 1)).toBe(30);
    expect(juzOf(114, 6)).toBe(30);
  });
  it("sums coverage per juz", () => {
    const res = coverageByJuz([{ surah: 114, from: 1, to: 6 }, { surah: 112, from: 1, to: 4 }], counts);
    expect(res).toHaveLength(30);
    expect(res[29]!.memorized).toBe(10);
    expect(res[0]!.memorized).toBe(0);
    expect(totalAyahs(counts)).toBe(308);
  });
});

describe("week helpers", () => {
  it("starts the week on Monday", () => {
    expect(weekStart(new Date("2026-10-14T10:00:00Z")).toISOString()).toBe("2026-10-12T00:00:00.000Z");
    expect(weekStart(new Date("2026-10-18T23:00:00Z")).toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });
  it("caps weekly percent", () => {
    expect(weeklyPercent(7, 5)).toBe(100);
    expect(weeklyPercent(1, 4)).toBe(25);
    expect(weeklyPercent(1, 0)).toBe(0);
  });
});

import { intersectionSize, planToRanges } from "./hifz-ranges";

describe("plan ranges", () => {
  it("expands a multi-surah plan", () => {
    const r = planToRanges({ fromSurah: 113, fromAyah: 3, toSurah: 114, toAyah: 2 }, counts);
    expect(r).toEqual([
      { surah: 113, from: 3, to: 5 },
      { surah: 114, from: 1, to: 2 },
    ]);
  });
  it("treats a null end as the end of the surah", () => {
    expect(planToRanges({ fromSurah: 112, fromAyah: 1, toSurah: 112, toAyah: null }, counts)).toEqual([{ surah: 112, from: 1, to: 4 }]);
  });
  it("counts the intersection once", () => {
    const plan = planToRanges({ fromSurah: 114, fromAyah: 1, toSurah: 114, toAyah: 6 }, counts);
    expect(intersectionSize(plan, [{ surah: 114, from: 2, to: 4 }, { surah: 114, from: 3, to: 5 }])).toBe(4);
  });
});
