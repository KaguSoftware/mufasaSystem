import "server-only";
import { and, eq, getDb, inArray, schema } from "@mufasa/db";
import { t18n } from "@mufasa/config/locales";
import { isEnabled } from "../flags";
import { notify } from "../notify";
import { issueCertificate } from "./certificates";
import { awardXp } from "./gamification";

export const COURSE_COMPLETION_XP = 50;

/**
 * Called once when a learner finishes every published lesson of a course
 * (enrollments.completedAt has just been set). Safe to call twice: the XP
 * award is idempotent through its refKey.
 */
export async function onCourseCompleted(userId: string, courseId: string): Promise<void> {
  const db = getDb();
  const [course, user] = await Promise.all([
    db.query.courses.findFirst({ where: eq(schema.courses.id, courseId), columns: { id: true, title: true } }),
    db.query.user.findFirst({ where: eq(schema.user.id, userId), columns: { locale: true } }),
  ]);
  if (!course) return;

  const res = await awardXp(userId, "course_completed", COURSE_COMPLETION_XP, `course_completed:${courseId}`, { courseId });
  if (res.awarded) {
    await notify(userId, "courseCompleted", { course: t18n(course.title, user?.locale ?? "en") }, "/student/courses");
  }

  // Certificate for (userId, courseId). Idempotent, and never allowed to break course completion.
  try {
    if ((await isEnabled("certificates", { id: userId, role: "student" })) && (await passedAllLessonQuizzes(userId, courseId))) {
      await issueCertificate({ userId, courseId, title: course.title });
    }
  } catch (err) {
    console.error("[course-completion] certificate issue failed", err);
  }
}

/** True when every published lesson that has a lesson-kind quiz has a passing attempt by the user. */
async function passedAllLessonQuizzes(userId: string, courseId: string): Promise<boolean> {
  const db = getDb();
  const quizzes = await db
    .select({ id: schema.quizzes.id })
    .from(schema.quizzes)
    .innerJoin(schema.lessons, eq(schema.lessons.id, schema.quizzes.lessonId))
    .where(and(eq(schema.lessons.courseId, courseId), eq(schema.lessons.published, true), eq(schema.quizzes.kind, "lesson")));
  if (!quizzes.length) return true;
  const ids = quizzes.map((q) => q.id);
  const passed = await db
    .selectDistinct({ quizId: schema.quizAttempts.quizId })
    .from(schema.quizAttempts)
    .where(and(eq(schema.quizAttempts.userId, userId), eq(schema.quizAttempts.passed, true), inArray(schema.quizAttempts.quizId, ids)));
  return passed.length >= new Set(ids).size;
}
