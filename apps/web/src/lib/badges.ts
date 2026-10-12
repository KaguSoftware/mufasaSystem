import type { BadgeRule, XpReason } from "@mufasa/db/schema";

/** Aggregated numbers the badge rules are evaluated against. */
export type BadgeStats = {
  currentStreak: number;
  longestStreak: number;
  totalXp: number;
  /** Number of xp_events per reason. */
  countsByReason: Partial<Record<XpReason, number>>;
  completedCourseIds: string[];
  /** Total memorized ayahs (hifz entries with status memorized). */
  hifzAyahs: number;
};

export function evaluateBadgeRule(rule: BadgeRule, stats: BadgeStats): boolean {
  switch (rule.type) {
    case "streak":
      return Math.max(stats.currentStreak, stats.longestStreak) >= rule.days;
    case "total_xp":
      return stats.totalXp >= rule.amount;
    case "count":
      return (stats.countsByReason[rule.reason] ?? 0) >= rule.count;
    case "course_completed":
      return rule.courseId ? stats.completedCourseIds.includes(rule.courseId) : stats.completedCourseIds.length > 0;
    case "hifz_ayahs":
      return stats.hifzAyahs >= rule.count;
    default:
      return false;
  }
}

/** Ids of badges whose rule is met and that are not yet earned. */
export function newlyEarnedBadges(
  badges: { id: string; rule: BadgeRule }[],
  stats: BadgeStats,
  alreadyEarned: ReadonlySet<string>,
): string[] {
  return badges.filter((b) => !alreadyEarned.has(b.id) && evaluateBadgeRule(b.rule, stats)).map((b) => b.id);
}
