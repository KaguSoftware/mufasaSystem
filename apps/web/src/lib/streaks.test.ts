import { describe, expect, it } from "vitest";
import { INITIAL_STREAK, daysBetween, isoWeek, localDateString, updateStreak, type StreakState } from "./streaks";

const base = (over: Partial<StreakState> = {}): StreakState => ({
  current: 3,
  longest: 5,
  lastActiveDate: "2026-10-07",
  freezesAvailable: 1,
  freezeWeek: "2026-W41",
  ...over,
});

describe("streak date helpers", () => {
  it("computes day gaps across month boundaries", () => {
    expect(daysBetween("2026-01-31", "2026-02-01")).toBe(1);
    expect(daysBetween("2026-10-07", "2026-10-09")).toBe(2);
  });
  it("computes ISO weeks", () => {
    expect(isoWeek("2026-10-07")).toBe("2026-W41");
    expect(isoWeek("2026-01-01")).toBe("2026-W01");
    expect(isoWeek("2027-01-03")).toBe("2026-W53");
  });
  it("formats a local date in a timezone", () => {
    expect(localDateString(new Date("2026-10-07T22:30:00Z"), "Europe/Istanbul")).toBe("2026-10-08");
    expect(localDateString(new Date("2026-10-07T22:30:00Z"), "Not/AZone")).toBe("2026-10-07");
  });
});

describe("updateStreak", () => {
  it("starts at 1 for a first activity", () => {
    const s = updateStreak(INITIAL_STREAK, "2026-10-07");
    expect(s.current).toBe(1);
    expect(s.longest).toBe(1);
    expect(s.lastActiveDate).toBe("2026-10-07");
  });
  it("keeps the streak on the same day", () => {
    const s = updateStreak(base(), "2026-10-07");
    expect(s.current).toBe(3);
    expect(s.freezesAvailable).toBe(1);
  });
  it("adds one for consecutive days and tracks longest", () => {
    const s = updateStreak(base({ current: 5, longest: 5 }), "2026-10-08");
    expect(s.current).toBe(6);
    expect(s.longest).toBe(6);
  });
  it("uses a freeze for exactly one missed day", () => {
    const s = updateStreak(base(), "2026-10-09");
    expect(s.current).toBe(4);
    expect(s.freezesAvailable).toBe(0);
  });
  it("resets when a day is missed and no freeze is left", () => {
    const s = updateStreak(base({ freezesAvailable: 0 }), "2026-10-09");
    expect(s.current).toBe(1);
    expect(s.longest).toBe(5);
  });
  it("resets after two or more missed days even with a freeze", () => {
    expect(updateStreak(base(), "2026-10-10").current).toBe(1);
  });
  it("refills the freeze at the start of a new ISO week", () => {
    // 2026-10-12 is a Monday (W42): freeze refills, then is spent on the missed Sunday
    const s = updateStreak(base({ lastActiveDate: "2026-10-10", freezesAvailable: 0, freezeWeek: "2026-W41" }), "2026-10-12");
    expect(s.freezeWeek).toBe("2026-W42");
    expect(s.current).toBe(4);
    expect(s.freezesAvailable).toBe(0);
  });
  it("refills to 1 and never above", () => {
    const s = updateStreak(base({ freezesAvailable: 1, freezeWeek: "2026-W40" }), "2026-10-08");
    expect(s.freezesAvailable).toBe(1);
  });
});
