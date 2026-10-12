import "server-only";
import { and, count, eq, getDb, isNotNull, schema, sql, type XpReason } from "@mufasa/db";
import { t18n } from "@mufasa/config/locales";
import { newlyEarnedBadges, type BadgeStats } from "@/lib/badges";
import { INITIAL_STREAK, localDateString, updateStreak } from "@/lib/streaks";
import { isEnabled } from "../flags";
import { notify } from "../notify";

export type AwardResult = { awarded: boolean; newBadgeIds: string[] };

/**
 * Records XP for a user. Idempotent: when `refKey` is given, the unique
 * (userId, refKey) index guarantees the same event is never paid twice, and a
 * duplicate returns early with `awarded: false`.
 *
 * Flag `gamification` off: the xp_events row and streaks.totalXp are still
 * recorded (so history is never lost when an admin toggles the feature), but
 * the daily streak, badge evaluation and notifications are skipped.
 */
export async function awardXp(
  userId: string,
  reason: XpReason,
  amount: number,
  refKey?: string,
  meta?: Record<string, unknown>,
): Promise<AwardResult> {
  const db = getDb();
  const inserted = await db
    .insert(schema.xpEvents)
    .values({ userId, reason, amount, refKey: refKey ?? null, meta: meta ?? null })
    .onConflictDoNothing()
    .returning({ id: schema.xpEvents.id });
  if (inserted.length === 0) return { awarded: false, newBadgeIds: [] };

  const u = await db.query.user.findFirst({
    where: eq(schema.user.id, userId),
    columns: { id: true, role: true, timezone: true, locale: true },
  });
  if (!u) return { awarded: true, newBadgeIds: [] };

  const gamification = await isEnabled("gamification", { id: u.id, role: u.role });
  const existing = await db.query.streaks.findFirst({ where: eq(schema.streaks.userId, userId) });

  if (!gamification) {
    await db
      .insert(schema.streaks)
      .values({ userId, totalXp: amount })
      .onConflictDoUpdate({ target: schema.streaks.userId, set: { totalXp: sql`${schema.streaks.totalXp} + ${amount}` } });
    return { awarded: true, newBadgeIds: [] };
  }

  const today = localDateString(new Date(), u.timezone);
  const next = updateStreak(
    existing
      ? {
          current: existing.current,
          longest: existing.longest,
          lastActiveDate: existing.lastActiveDate,
          freezesAvailable: existing.freezesAvailable,
          freezeWeek: existing.freezeWeek,
        }
      : INITIAL_STREAK,
    today,
  );
  const totalXp = (existing?.totalXp ?? 0) + amount;
  await db
    .insert(schema.streaks)
    .values({ userId, ...next, totalXp })
    .onConflictDoUpdate({
      target: schema.streaks.userId,
      set: {
        current: next.current,
        longest: next.longest,
        lastActiveDate: next.lastActiveDate,
        freezesAvailable: next.freezesAvailable,
        freezeWeek: next.freezeWeek,
        totalXp: sql`${schema.streaks.totalXp} + ${amount}`,
      },
    });

  const newBadgeIds = await evaluateAndGrantBadges(userId, u.locale, {
    currentStreak: next.current,
    longestStreak: next.longest,
    totalXp,
  });
  return { awarded: true, newBadgeIds };
}

/** Re-checks every active badge for a user (also callable after non-XP events). */
export async function evaluateAndGrantBadges(
  userId: string,
  locale: string,
  base: Pick<BadgeStats, "currentStreak" | "longestStreak" | "totalXp">,
): Promise<string[]> {
  const db = getDb();
  const [badges, earned, reasonCounts, completed, hifz] = await Promise.all([
    db.select().from(schema.badges).where(eq(schema.badges.active, true)),
    db.select({ badgeId: schema.userBadges.badgeId }).from(schema.userBadges).where(eq(schema.userBadges.userId, userId)),
    db
      .select({ reason: schema.xpEvents.reason, n: count() })
      .from(schema.xpEvents)
      .where(eq(schema.xpEvents.userId, userId))
      .groupBy(schema.xpEvents.reason),
    db
      .select({ courseId: schema.enrollments.courseId })
      .from(schema.enrollments)
      .where(and(eq(schema.enrollments.userId, userId), isNotNull(schema.enrollments.completedAt))),
    db
      .select({ n: sql<number>`coalesce(sum(${schema.hifzEntries.ayahTo} - ${schema.hifzEntries.ayahFrom} + 1), 0)::int` })
      .from(schema.hifzEntries)
      .where(and(eq(schema.hifzEntries.studentId, userId), eq(schema.hifzEntries.status, "memorized"))),
  ]);

  const stats: BadgeStats = {
    ...base,
    countsByReason: Object.fromEntries(reasonCounts.map((r) => [r.reason, r.n])),
    completedCourseIds: completed.map((c) => c.courseId),
    hifzAyahs: hifz[0]?.n ?? 0,
  };
  const ids = newlyEarnedBadges(
    badges.map((b) => ({ id: b.id, rule: b.rule })),
    stats,
    new Set(earned.map((e) => e.badgeId)),
  );
  if (!ids.length) return [];

  const granted = await db
    .insert(schema.userBadges)
    .values(ids.map((badgeId) => ({ userId, badgeId })))
    .onConflictDoNothing()
    .returning({ badgeId: schema.userBadges.badgeId });
  for (const g of granted) {
    const badge = badges.find((b) => b.id === g.badgeId);
    if (badge) await notify(userId, "badgeEarned", { badge: t18n(badge.name, locale) }, "/student/achievements");
  }
  return granted.map((g) => g.badgeId);
}
