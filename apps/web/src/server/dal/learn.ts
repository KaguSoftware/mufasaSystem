import "server-only";
import { and, asc, count, desc, eq, getDb, gt, inArray, isNotNull, isNull, ne, notInArray, schema, sql } from "@mufasa/db";
import { assertCanAccessStudent, isParentOf, type SessionUser } from "../session";
import { assertLessonAccess, hasCourseAccess } from "../access";
import { AppError, forbidden, notFound } from "../errors";
import { progressPercent } from "@/lib/progress";
import { storage } from "../storage";
import { awardXp } from "../services/gamification";
import { onCourseCompleted } from "../services/course-completion";
import { getCourseBySlug, type CourseDetail } from "./catalog";
import { syncLessonHomework } from "./homework";

type Actor = Pick<SessionUser, "id" | "role">;

/** A lesson counts as complete once this share of it has been watched. */
export const COMPLETE_AT_PERCENT = 90;

// ───────────── Enrollment ─────────────

/** Self, a parent for their child, or an admin. Tutors cannot enroll students. */
export async function enroll(actor: Actor, studentId: string, courseId: string) {
  let source: "self" | "parent" | "admin";
  if (actor.id === studentId) source = "self";
  else if (actor.role === "admin") source = "admin";
  else if (actor.role === "parent" && (await isParentOf(actor.id, studentId))) source = "parent";
  else throw forbidden();

  const db = getDb();
  const course = await db.query.courses.findFirst({
    where: eq(schema.courses.id, courseId),
    columns: { id: true, published: true },
  });
  if (!course || (!course.published && actor.role !== "admin")) throw notFound();
  await db.insert(schema.enrollments).values({ userId: studentId, courseId, source }).onConflictDoNothing();
  return { courseId };
}

/** Internal: make sure the learner has an enrollment row (used when they open a lesson). */
async function ensureEnrollment(userId: string, courseId: string) {
  await getDb().insert(schema.enrollments).values({ userId, courseId, source: "self" }).onConflictDoNothing();
}

// ───────────── Course lists with progress ─────────────

export type MyCourse = {
  courseId: string;
  slug: string;
  title: typeof schema.courses.$inferSelect.title;
  programName: typeof schema.programs.$inferSelect.name;
  coverPath: string | null;
  isFree: boolean;
  totalLessons: number;
  completedLessons: number;
  percent: number;
  completedAt: Date | null;
  nextLessonId: string | null;
};

async function progressCounts(userId: string, courseIds: string[]) {
  if (!courseIds.length) return { totals: new Map<string, number>(), done: new Map<string, number>() };
  const db = getDb();
  const [totals, done] = await Promise.all([
    db
      .select({ courseId: schema.lessons.courseId, n: count() })
      .from(schema.lessons)
      .where(and(inArray(schema.lessons.courseId, courseIds), eq(schema.lessons.published, true)))
      .groupBy(schema.lessons.courseId),
    db
      .select({ courseId: schema.lessons.courseId, n: count() })
      .from(schema.lessonProgress)
      .innerJoin(schema.lessons, eq(schema.lessons.id, schema.lessonProgress.lessonId))
      .where(
        and(
          eq(schema.lessonProgress.userId, userId),
          inArray(schema.lessons.courseId, courseIds),
          eq(schema.lessons.published, true),
          isNotNull(schema.lessonProgress.completedAt),
        ),
      )
      .groupBy(schema.lessons.courseId),
  ]);
  return {
    totals: new Map(totals.map((r) => [r.courseId, r.n])),
    done: new Map(done.map((r) => [r.courseId, r.n])),
  };
}

export const percentOf = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0);

export async function myCourses(actor: Actor, studentId: string): Promise<MyCourse[]> {
  await assertCanAccessStudent(actor as SessionUser, studentId);
  const db = getDb();
  const rows = await db
    .select({
      course: schema.courses,
      programName: schema.programs.name,
      completedAt: schema.enrollments.completedAt,
      enrolledAt: schema.enrollments.enrolledAt,
    })
    .from(schema.enrollments)
    .innerJoin(schema.courses, eq(schema.courses.id, schema.enrollments.courseId))
    .innerJoin(schema.programs, eq(schema.programs.id, schema.courses.programId))
    .where(eq(schema.enrollments.userId, studentId))
    .orderBy(desc(schema.enrollments.enrolledAt));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.course.id);
  const { totals, done } = await progressCounts(studentId, ids);

  // Next lesson to continue = first published, not completed lesson in syllabus order.
  const lessons = await db
    .select({
      id: schema.lessons.id,
      courseId: schema.lessons.courseId,
      lessonSort: schema.lessons.sortOrder,
      unitSort: schema.units.sortOrder,
    })
    .from(schema.lessons)
    .innerJoin(schema.units, eq(schema.units.id, schema.lessons.unitId))
    .where(and(inArray(schema.lessons.courseId, ids), eq(schema.lessons.published, true)));
  const completed = await db
    .select({ lessonId: schema.lessonProgress.lessonId })
    .from(schema.lessonProgress)
    .where(and(eq(schema.lessonProgress.userId, studentId), isNotNull(schema.lessonProgress.completedAt)));
  const completedSet = new Set(completed.map((c) => c.lessonId));

  return rows.map((r) => {
    const mine = lessons
      .filter((l) => l.courseId === r.course.id)
      .sort((a, b) => a.unitSort - b.unitSort || a.lessonSort - b.lessonSort);
    const next = mine.find((l) => !completedSet.has(l.id)) ?? mine[0] ?? null;
    const total = totals.get(r.course.id) ?? 0;
    const finished = done.get(r.course.id) ?? 0;
    return {
      courseId: r.course.id,
      slug: r.course.slug,
      title: r.course.title,
      programName: r.programName,
      coverPath: r.course.coverPath,
      isFree: r.course.isFree,
      totalLessons: total,
      completedLessons: finished,
      percent: percentOf(finished, total),
      completedAt: r.completedAt,
      nextLessonId: next?.id ?? null,
    };
  });
}

/** Published courses the student is not enrolled in yet, with whether they already have access. */
export async function availableCourses(actor: Actor, studentId: string) {
  await assertCanAccessStudent(actor as SessionUser, studentId);
  const db = getDb();
  const enrolled = await db
    .select({ courseId: schema.enrollments.courseId })
    .from(schema.enrollments)
    .where(eq(schema.enrollments.userId, studentId));
  const ids = enrolled.map((e) => e.courseId);
  const rows = await db
    .select({ course: schema.courses, programName: schema.programs.name })
    .from(schema.courses)
    .innerJoin(schema.programs, eq(schema.programs.id, schema.courses.programId))
    .where(
      and(
        eq(schema.courses.published, true),
        eq(schema.programs.published, true),
        ids.length ? notInArray(schema.courses.id, ids) : undefined,
      ),
    )
    .orderBy(asc(schema.programs.sortOrder), asc(schema.courses.sortOrder));
  return rows.map((r) => ({
    id: r.course.id,
    slug: r.course.slug,
    title: r.course.title,
    description: r.course.description,
    level: r.course.level,
    isFree: r.course.isFree,
    programName: r.programName,
  }));
}

export type StudentCourseView = {
  course: CourseDetail;
  enrolled: boolean;
  hasAccess: boolean;
  completedLessonIds: string[];
  percent: number;
};

/** Syllabus page data. Access is evaluated for the student, not for the viewer. */
export async function getStudentCourseView(actor: Actor, studentId: string, slug: string): Promise<StudentCourseView> {
  await assertCanAccessStudent(actor as SessionUser, studentId);
  const course = await getCourseBySlug(slug, actor);
  if (!course) throw notFound();
  const db = getDb();
  const learner: Actor = studentId === actor.id ? actor : { id: studentId, role: "student" };
  const [access, enrollment, progress] = await Promise.all([
    hasCourseAccess(learner, course.id),
    db.query.enrollments.findFirst({
      where: and(eq(schema.enrollments.userId, studentId), eq(schema.enrollments.courseId, course.id)),
      columns: { courseId: true },
    }),
    db
      .select({ lessonId: schema.lessonProgress.lessonId })
      .from(schema.lessonProgress)
      .where(
        and(
          eq(schema.lessonProgress.userId, studentId),
          eq(schema.lessonProgress.courseId, course.id),
          isNotNull(schema.lessonProgress.completedAt),
        ),
      ),
  ]);
  const publishedIds = new Set(course.units.flatMap((u) => u.lessons.filter((l) => l.published).map((l) => l.id)));
  const completedLessonIds = progress.map((p) => p.lessonId).filter((id) => publishedIds.has(id));
  return {
    course,
    enrolled: Boolean(enrollment),
    hasAccess: access.allowed,
    completedLessonIds,
    percent: percentOf(completedLessonIds.length, publishedIds.size),
  };
}

// ───────────── Lesson player ─────────────

export type PlayerLesson = {
  id: string;
  courseId: string;
  courseSlug: string;
  courseTitle: typeof schema.courses.$inferSelect.title;
  unitTitle: typeof schema.units.$inferSelect.title;
  type: typeof schema.lessons.$inferSelect.type;
  title: typeof schema.lessons.$inferSelect.title;
  summary: typeof schema.lessons.$inferSelect.summary;
  body: typeof schema.lessons.$inferSelect.body;
  xpReward: number;
  durationSec: number | null;
  /** Short-lived signed URL; null when no video or storage is not configured. */
  videoUrl: string | null;
  assets: { id: string; kind: string; title: typeof schema.lessonAssets.$inferSelect.title; url: string | null }[];
  progress: { positionSec: number; percent: number; completed: boolean };
  prevLessonId: string | null;
  nextLessonId: string | null;
};

async function safeSignedUrl(bucket: "lessonVideos" | "lessonAssets", path: string): Promise<string | null> {
  try {
    return await storage().signedUrl(bucket, path, 60 * 60 * 3);
  } catch {
    return null; // storage not configured or object missing: render without media
  }
}

export async function getLessonForPlayer(actor: Actor, lessonId: string): Promise<PlayerLesson> {
  await assertLessonAccess(actor, lessonId);
  const db = getDb();
  const [row] = await db
    .select({
      lesson: schema.lessons,
      courseSlug: schema.courses.slug,
      courseTitle: schema.courses.title,
      unitTitle: schema.units.title,
    })
    .from(schema.lessons)
    .innerJoin(schema.courses, eq(schema.courses.id, schema.lessons.courseId))
    .innerJoin(schema.units, eq(schema.units.id, schema.lessons.unitId))
    .where(eq(schema.lessons.id, lessonId))
    .limit(1);
  if (!row) throw notFound();
  const l = row.lesson;
  const staff = actor.role === "admin" || actor.role === "tutor";

  const [assets, progress, siblings] = await Promise.all([
    db.select().from(schema.lessonAssets).where(eq(schema.lessonAssets.lessonId, lessonId)).orderBy(asc(schema.lessonAssets.sortOrder)),
    db.query.lessonProgress.findFirst({
      where: and(eq(schema.lessonProgress.userId, actor.id), eq(schema.lessonProgress.lessonId, lessonId)),
    }),
    db
      .select({ id: schema.lessons.id, lessonSort: schema.lessons.sortOrder, unitSort: schema.units.sortOrder })
      .from(schema.lessons)
      .innerJoin(schema.units, eq(schema.units.id, schema.lessons.unitId))
      .where(and(eq(schema.lessons.courseId, l.courseId), staff ? undefined : eq(schema.lessons.published, true))),
  ]);
  const ordered = siblings.sort((a, b) => a.unitSort - b.unitSort || a.lessonSort - b.lessonSort);
  const idx = ordered.findIndex((s) => s.id === lessonId);

  const [videoUrl, assetUrls] = await Promise.all([
    l.videoPath ? safeSignedUrl("lessonVideos", l.videoPath) : Promise.resolve(null),
    Promise.all(assets.map((a) => (a.url ? Promise.resolve(a.url) : a.path ? safeSignedUrl("lessonAssets", a.path) : null))),
  ]);

  return {
    id: l.id,
    courseId: l.courseId,
    courseSlug: row.courseSlug,
    courseTitle: row.courseTitle,
    unitTitle: row.unitTitle,
    type: l.type,
    title: l.title,
    summary: l.summary,
    body: l.body,
    xpReward: l.xpReward,
    durationSec: l.videoDurationSec,
    videoUrl,
    assets: assets.map((a, i) => ({ id: a.id, kind: a.kind, title: a.title, url: assetUrls[i] ?? null })),
    progress: {
      positionSec: progress?.positionSec ?? 0,
      percent: progress?.percent ?? 0,
      completed: Boolean(progress?.completedAt),
    },
    prevLessonId: idx > 0 ? ordered[idx - 1]!.id : null,
    nextLessonId: idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1]!.id : null,
  };
}

// ───────────── Progress ─────────────

export type ProgressResult = { percent: number; completed: boolean; justCompleted: boolean; courseCompleted: boolean };

/**
 * Applies progress for a learner. Position and percent only ever increase.
 * Completion (>= 90% or `force`) happens once: it awards lesson XP and then
 * checks whether the whole course is finished.
 */
async function applyProgress(
  userId: string,
  lesson: { id: string; courseId: string; xpReward: number },
  positionSec: number,
  percent: number,
  force: boolean,
): Promise<ProgressResult> {
  const db = getDb();
  const pct = force ? 100 : Math.max(0, Math.min(100, Math.round(percent)));
  const pos = Math.max(0, Math.round(positionSec));

  await ensureEnrollment(userId, lesson.courseId);
  const [saved] = await db
    .insert(schema.lessonProgress)
    .values({ userId, lessonId: lesson.id, courseId: lesson.courseId, positionSec: pos, percent: pct })
    .onConflictDoUpdate({
      target: [schema.lessonProgress.userId, schema.lessonProgress.lessonId],
      set: {
        positionSec: sql`greatest(${schema.lessonProgress.positionSec}, ${pos})`,
        percent: sql`greatest(${schema.lessonProgress.percent}, ${pct})`,
      },
    })
    .returning();

  let justCompleted = false;
  let courseCompleted = false;
  if (saved && saved.percent >= COMPLETE_AT_PERCENT) {
    const flipped = await db
      .update(schema.lessonProgress)
      .set({ completedAt: new Date() })
      .where(
        and(
          eq(schema.lessonProgress.userId, userId),
          eq(schema.lessonProgress.lessonId, lesson.id),
          isNull(schema.lessonProgress.completedAt),
        ),
      )
      .returning({ lessonId: schema.lessonProgress.lessonId });
    if (flipped.length) {
      justCompleted = true;
      await syncLessonHomework(userId, lesson.id); // module B1: auto-satisfy lesson homework
      if (lesson.xpReward > 0) await awardXp(userId, "lesson_completed", lesson.xpReward, `lesson_completed:${lesson.id}`, { lessonId: lesson.id });
      courseCompleted = await checkCourseCompletion(userId, lesson.courseId);
    }
  }
  return { percent: saved?.percent ?? pct, completed: Boolean(saved && saved.percent >= COMPLETE_AT_PERCENT), justCompleted, courseCompleted };
}

/** True when this call just completed the course (every published lesson is done). */
async function checkCourseCompletion(userId: string, courseId: string): Promise<boolean> {
  const { totals, done } = await progressCounts(userId, [courseId]);
  const total = totals.get(courseId) ?? 0;
  if (total === 0 || (done.get(courseId) ?? 0) < total) return false;
  const flipped = await getDb()
    .update(schema.enrollments)
    .set({ completedAt: new Date() })
    .where(
      and(
        eq(schema.enrollments.userId, userId),
        eq(schema.enrollments.courseId, courseId),
        isNull(schema.enrollments.completedAt),
      ),
    )
    .returning({ courseId: schema.enrollments.courseId });
  if (!flipped.length) return false;
  await onCourseCompleted(userId, courseId);
  return true;
}

export async function recordProgress(actor: Actor, lessonId: string, positionSec: number, durationSec: number): Promise<ProgressResult> {
  await assertLessonAccess(actor, lessonId);
  const full = await getDb().query.lessons.findFirst({
    where: eq(schema.lessons.id, lessonId),
    columns: { id: true, courseId: true, xpReward: true, videoDurationSec: true },
  });
  if (!full) throw notFound();
  const percent = progressPercent(positionSec, full.videoDurationSec, durationSec);
  if (percent === null) throw new AppError("validation", "invalid_progress");
  return applyProgress(actor.id, full, positionSec, percent, false);
}

/** For reading / quiz lessons that have no video: the learner marks them done. */
export async function markLessonComplete(actor: Actor, lessonId: string): Promise<ProgressResult> {
  await assertLessonAccess(actor, lessonId);
  const db = getDb();
  const lesson = await db.query.lessons.findFirst({
    where: eq(schema.lessons.id, lessonId),
    columns: { type: true, videoPath: true, videoDurationSec: true },
  });
  if (!lesson) throw notFound();
  const quiz = await db.query.quizzes.findFirst({
    where: and(eq(schema.quizzes.lessonId, lessonId), eq(schema.quizzes.kind, "lesson")),
    columns: { id: true },
  });
  const manual = lesson.type === "reading" || lesson.type === "live" || lesson.type === "recitation";
  if (!manual || lesson.videoPath || lesson.videoDurationSec || quiz) throw new AppError("validation", "not_manually_completable");
  return completeLessonFor(actor.id, lessonId);
}

/** Internal (no access check): used by the quiz DAL after the access check there. */
export async function completeLessonFor(userId: string, lessonId: string): Promise<ProgressResult> {
  const full = await getDb().query.lessons.findFirst({
    where: eq(schema.lessons.id, lessonId),
    columns: { id: true, courseId: true, xpReward: true },
  });
  if (!full) throw notFound();
  return applyProgress(userId, full, 0, 100, true);
}

// ───────────── Dashboard and achievements ─────────────

export async function studentDashboard(actor: Actor, studentId: string) {
  await assertCanAccessStudent(actor as SessionUser, studentId);
  const db = getDb();
  const [courses, streak, badges] = await Promise.all([
    myCourses(actor, studentId),
    db.query.streaks.findFirst({ where: eq(schema.streaks.userId, studentId) }),
    db
      .select({ badge: schema.badges, awardedAt: schema.userBadges.awardedAt })
      .from(schema.userBadges)
      .innerJoin(schema.badges, eq(schema.badges.id, schema.userBadges.badgeId))
      .where(eq(schema.userBadges.userId, studentId))
      .orderBy(desc(schema.userBadges.awardedAt))
      .limit(4),
  ]);
  const inProgress = courses.filter((c) => !c.completedAt && c.nextLessonId);
  return {
    continueCourse: inProgress[0] ?? null,
    courses,
    streak: { current: streak?.current ?? 0, longest: streak?.longest ?? 0, freezesAvailable: streak?.freezesAvailable ?? 0 },
    totalXp: streak?.totalXp ?? 0,
    recentBadges: badges.map((b) => ({ ...b.badge, awardedAt: b.awardedAt })),
  };
}

export async function achievements(actor: Actor, studentId: string) {
  await assertCanAccessStudent(actor as SessionUser, studentId);
  const db = getDb();
  const [streak, all, earned, recent] = await Promise.all([
    db.query.streaks.findFirst({ where: eq(schema.streaks.userId, studentId) }),
    db.select().from(schema.badges).where(eq(schema.badges.active, true)).orderBy(asc(schema.badges.createdAt)),
    db.select().from(schema.userBadges).where(eq(schema.userBadges.userId, studentId)),
    db
      .select({ reason: schema.xpEvents.reason, amount: schema.xpEvents.amount, createdAt: schema.xpEvents.createdAt })
      .from(schema.xpEvents)
      .where(and(eq(schema.xpEvents.userId, studentId), gt(schema.xpEvents.amount, 0), ne(schema.xpEvents.reason, "admin_adjustment")))
      .orderBy(desc(schema.xpEvents.createdAt))
      .limit(10),
  ]);
  const earnedMap = new Map(earned.map((e) => [e.badgeId, e.awardedAt]));
  return {
    totalXp: streak?.totalXp ?? 0,
    streak: { current: streak?.current ?? 0, longest: streak?.longest ?? 0, freezesAvailable: streak?.freezesAvailable ?? 0 },
    badges: all.map((b) => ({ ...b, earnedAt: earnedMap.get(b.id) ?? null })),
    recentXp: recent,
  };
}
