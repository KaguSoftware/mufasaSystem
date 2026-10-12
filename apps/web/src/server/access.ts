import "server-only";
import { and, eq, getDb, gt, isNull, lte, or, schema } from "@mufasa/db";
import { AppError, notFound } from "./errors";
import type { SessionUser } from "./session";

/**
 * THE access rule for paid content. A learner can open a course when ANY of:
 *  1. the course is free (or the lesson is a preview)
 *  2. they are staff (admin / tutor)
 *  3. an active admin grant covers it (manual WhatsApp/IBAN path), scope all/program/course
 *  4. an active subscription seat covers it (iyzico OR manual subscription), and the
 *     plan unlocks the course's program (empty plan.programIds = everything)
 */
export type AccessTarget = { courseId: string; programId: string; isFree?: boolean };

export type ActiveGrant = Pick<
  typeof schema.accessGrants.$inferSelect,
  "scope" | "programId" | "courseId" | "expiresAt"
>;
export type ActiveSeatPlan = { programIds: string[]; currentPeriodEnd: Date | null };

/** Pure decision, exported for unit tests. */
export function decideAccess(
  target: AccessTarget,
  role: SessionUser["role"],
  grants: ActiveGrant[],
  seats: ActiveSeatPlan[],
): { allowed: boolean; via: "free" | "staff" | "grant" | "subscription" | null; until: Date | null } {
  if (target.isFree) return { allowed: true, via: "free", until: null };
  if (role === "admin" || role === "tutor") return { allowed: true, via: "staff", until: null };
  const grant = grants.find(
    (g) =>
      g.scope === "all" ||
      (g.scope === "program" && g.programId === target.programId) ||
      (g.scope === "course" && g.courseId === target.courseId),
  );
  if (grant) return { allowed: true, via: "grant", until: grant.expiresAt };
  const seat = seats.find((s) => s.programIds.length === 0 || s.programIds.includes(target.programId));
  if (seat) return { allowed: true, via: "subscription", until: seat.currentPeriodEnd };
  return { allowed: false, via: null, until: null };
}

export async function activeGrantsFor(userId: string, now = new Date()): Promise<ActiveGrant[]> {
  return getDb()
    .select({
      scope: schema.accessGrants.scope,
      programId: schema.accessGrants.programId,
      courseId: schema.accessGrants.courseId,
      expiresAt: schema.accessGrants.expiresAt,
    })
    .from(schema.accessGrants)
    .where(
      and(
        eq(schema.accessGrants.userId, userId),
        isNull(schema.accessGrants.revokedAt),
        lte(schema.accessGrants.startsAt, now),
        or(isNull(schema.accessGrants.expiresAt), gt(schema.accessGrants.expiresAt, now)),
      ),
    );
}

export async function activeSeatsFor(userId: string, now = new Date()): Promise<ActiveSeatPlan[]> {
  return getDb()
    .select({ programIds: schema.plans.programIds, currentPeriodEnd: schema.subscriptions.currentPeriodEnd })
    .from(schema.subscriptionSeats)
    .innerJoin(schema.subscriptions, eq(schema.subscriptions.id, schema.subscriptionSeats.subscriptionId))
    .innerJoin(schema.plans, eq(schema.plans.id, schema.subscriptions.planId))
    .where(
      and(
        eq(schema.subscriptionSeats.userId, userId),
        or(eq(schema.subscriptions.status, "active"), eq(schema.subscriptions.status, "past_due")),
        gt(schema.subscriptions.currentPeriodEnd, now),
      ),
    );
}

export async function hasCourseAccess(user: Pick<SessionUser, "id" | "role">, courseId: string) {
  const course = await getDb().query.courses.findFirst({
    where: eq(schema.courses.id, courseId),
    columns: { id: true, programId: true, isFree: true },
  });
  if (!course) throw notFound();
  const [grants, seats] = await Promise.all([activeGrantsFor(user.id), activeSeatsFor(user.id)]);
  return decideAccess({ courseId: course.id, programId: course.programId, isFree: course.isFree }, user.role, grants, seats);
}

export async function assertCourseAccess(user: Pick<SessionUser, "id" | "role">, courseId: string) {
  const res = await hasCourseAccess(user, courseId);
  if (!res.allowed) throw new AppError("no_access");
  return res;
}

/** Lesson-level: previews are always open. */
export async function assertLessonAccess(user: Pick<SessionUser, "id" | "role">, lessonId: string) {
  const lesson = await getDb().query.lessons.findFirst({
    where: eq(schema.lessons.id, lessonId),
    columns: { id: true, courseId: true, isPreview: true, published: true },
  });
  if (!lesson) throw notFound();
  const staff = user.role === "admin" || user.role === "tutor";
  if (!lesson.published && !staff) throw notFound();
  if (!staff) {
    // Unpublished course or program: hidden from non-staff.
    const [row] = await getDb()
      .select({ coursePublished: schema.courses.published, programPublished: schema.programs.published })
      .from(schema.courses)
      .innerJoin(schema.programs, eq(schema.programs.id, schema.courses.programId))
      .where(eq(schema.courses.id, lesson.courseId))
      .limit(1);
    if (!row || !row.coursePublished || !row.programPublished) throw notFound();
  }
  if (lesson.isPreview) return lesson;
  await assertCourseAccess(user, lesson.courseId);
  return lesson;
}
