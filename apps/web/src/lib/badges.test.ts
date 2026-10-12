import { describe, expect, it } from "vitest";
import type { BadgeRule } from "@mufasa/db/schema";
import { evaluateBadgeRule, newlyEarnedBadges, type BadgeStats } from "./badges";

const stats = (over: Partial<BadgeStats> = {}): BadgeStats => ({
  currentStreak: 0,
  longestStreak: 0,
  totalXp: 0,
  countsByReason: {},
  completedCourseIds: [],
  hifzAyahs: 0,
  ...over,
});

describe("evaluateBadgeRule", () => {
  it("streak", () => {
    const r: BadgeRule = { type: "streak", days: 7 };
    expect(evaluateBadgeRule(r, stats({ currentStreak: 6 }))).toBe(false);
    expect(evaluateBadgeRule(r, stats({ currentStreak: 7 }))).toBe(true);
    expect(evaluateBadgeRule(r, stats({ longestStreak: 9 }))).toBe(true);
  });
  it("total_xp", () => {
    const r: BadgeRule = { type: "total_xp", amount: 100 };
    expect(evaluateBadgeRule(r, stats({ totalXp: 99 }))).toBe(false);
    expect(evaluateBadgeRule(r, stats({ totalXp: 100 }))).toBe(true);
  });
  it("count", () => {
    const r: BadgeRule = { type: "count", reason: "lesson_completed", count: 10 };
    expect(evaluateBadgeRule(r, stats({ countsByReason: { lesson_completed: 9 } }))).toBe(false);
    expect(evaluateBadgeRule(r, stats({ countsByReason: { lesson_completed: 10 } }))).toBe(true);
    expect(evaluateBadgeRule(r, stats({ countsByReason: { quiz_passed: 50 } }))).toBe(false);
  });
  it("course_completed, any and specific", () => {
    expect(evaluateBadgeRule({ type: "course_completed" }, stats())).toBe(false);
    expect(evaluateBadgeRule({ type: "course_completed" }, stats({ completedCourseIds: ["a"] }))).toBe(true);
    expect(evaluateBadgeRule({ type: "course_completed", courseId: "b" }, stats({ completedCourseIds: ["a"] }))).toBe(false);
    expect(evaluateBadgeRule({ type: "course_completed", courseId: "a" }, stats({ completedCourseIds: ["a"] }))).toBe(true);
  });
  it("hifz_ayahs", () => {
    const r: BadgeRule = { type: "hifz_ayahs", count: 10 };
    expect(evaluateBadgeRule(r, stats({ hifzAyahs: 9 }))).toBe(false);
    expect(evaluateBadgeRule(r, stats({ hifzAyahs: 10 }))).toBe(true);
  });
});

describe("newlyEarnedBadges", () => {
  it("skips badges already earned", () => {
    const badges = [
      { id: "x", rule: { type: "total_xp", amount: 10 } as BadgeRule },
      { id: "y", rule: { type: "total_xp", amount: 10 } as BadgeRule },
      { id: "z", rule: { type: "total_xp", amount: 1000 } as BadgeRule },
    ];
    expect(newlyEarnedBadges(badges, stats({ totalXp: 50 }), new Set(["x"]))).toEqual(["y"]);
  });
});
