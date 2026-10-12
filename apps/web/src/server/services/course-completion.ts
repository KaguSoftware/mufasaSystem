import "server-only";
import { eq, getDb, schema } from "@mufasa/db";
import { t18n } from "@mufasa/config/locales";
import { notify } from "../notify";
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

  // certificates module hooks in here: issue the certificate for (userId, courseId).
}
