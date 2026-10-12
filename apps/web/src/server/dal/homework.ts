import "server-only";
import { and, desc, eq, getDb, gt, inArray, lte, or, schema } from "@mufasa/db";
import { isValidRange } from "@/lib/hifz-ranges";
import { AppError, conflict, forbidden, notFound } from "../errors";
import { awardXp } from "../services/gamification";
import { notify } from "../notify";
import { storage } from "../storage";
import { canAccessStudent, isParentOf, isTutorOf, type SessionUser } from "../session";
import { displayNames, parentIdsOf, surahCounts } from "./tutoring";

type Actor = Pick<SessionUser, "id" | "role">;
type HomeworkRow = typeof schema.homework.$inferSelect;

export const HOMEWORK_SUBMITTED_XP = 10;

// ───────────── Recipients ─────────────

/** Student ids a homework is assigned to (single student, or current group members). */
export async function homeworkRecipients(hw: Pick<HomeworkRow, "studentId" | "groupId">): Promise<string[]> {
  if (hw.studentId) return [hw.studentId];
  if (!hw.groupId) return [];
  const rows = await getDb()
    .select({ id: schema.classGroupMembers.studentId })
    .from(schema.classGroupMembers)
    .where(eq(schema.classGroupMembers.groupId, hw.groupId));
  return rows.map((r) => r.id);
}

export async function isHomeworkRecipient(studentId: string, hw: Pick<HomeworkRow, "studentId" | "groupId">): Promise<boolean> {
  if (hw.studentId) return hw.studentId === studentId;
  if (!hw.groupId) return false;
  const row = await getDb().query.classGroupMembers.findFirst({
    where: and(eq(schema.classGroupMembers.groupId, hw.groupId), eq(schema.classGroupMembers.studentId, studentId)),
    columns: { studentId: true },
  });
  return Boolean(row);
}

/** Homework rows currently assigned to a student (direct or via group membership). */
async function homeworkFor(studentId: string): Promise<HomeworkRow[]> {
  const db = getDb();
  const groups = await db
    .select({ id: schema.classGroupMembers.groupId })
    .from(schema.classGroupMembers)
    .where(eq(schema.classGroupMembers.studentId, studentId));
  const groupIds = groups.map((g) => g.id);
  return db
    .select()
    .from(schema.homework)
    .where(
      groupIds.length
        ? or(eq(schema.homework.studentId, studentId), inArray(schema.homework.groupId, groupIds))
        : eq(schema.homework.studentId, studentId),
    )
    .orderBy(desc(schema.homework.dueAt));
}

// ───────────── Create ─────────────

export type HomeworkInput = {
  groupId?: string | null;
  studentId?: string | null;
  title: string;
  instructions?: string | null;
  targetType: "lesson" | "quiz" | "recitation" | "free";
  lessonId?: string | null;
  quizId?: string | null;
  surah?: number | null;
  ayahFrom?: number | null;
  ayahTo?: number | null;
  dueAt: Date;
};

export async function createHomework(actor: Actor, input: HomeworkInput) {
  if (actor.role !== "tutor" && actor.role !== "admin") throw forbidden();
  const db = getDb();
  if (Boolean(input.groupId) === Boolean(input.studentId)) {
    throw new AppError("validation", "target", { studentId: ["group_or_student"] });
  }

  // Authorization: own group, or a student the tutor teaches.
  if (input.groupId) {
    const group = await db.query.classGroups.findFirst({ where: eq(schema.classGroups.id, input.groupId) });
    if (!group) throw notFound();
    if (actor.role === "tutor" && group.tutorId !== actor.id) throw forbidden();
  } else if (actor.role === "tutor" && !(await isTutorOf(actor.id, input.studentId!))) {
    throw forbidden();
  }

  // Target validation.
  let lessonId: string | null = null;
  let quizId: string | null = null;
  let surah: number | null = null;
  let ayahFrom: number | null = null;
  let ayahTo: number | null = null;
  if (input.targetType === "lesson") {
    if (!input.lessonId) throw new AppError("validation", "lesson", { lessonId: ["required"] });
    const lesson = await db.query.lessons.findFirst({ where: eq(schema.lessons.id, input.lessonId), columns: { id: true } });
    if (!lesson) throw new AppError("validation", "lesson", { lessonId: ["not_found"] });
    lessonId = lesson.id;
  } else if (input.targetType === "quiz") {
    if (!input.quizId) throw new AppError("validation", "quiz", { quizId: ["required"] });
    const quiz = await db.query.quizzes.findFirst({ where: eq(schema.quizzes.id, input.quizId), columns: { id: true, kind: true } });
    if (!quiz || quiz.kind !== "homework") throw new AppError("validation", "quiz", { quizId: ["not_found"] });
    quizId = quiz.id;
  } else if (input.targetType === "recitation") {
    surah = input.surah ?? null;
    ayahFrom = input.ayahFrom ?? null;
    ayahTo = input.ayahTo ?? null;
    if (surah === null || ayahFrom === null || ayahTo === null || !isValidRange({ surah, from: ayahFrom, to: ayahTo }, await surahCounts())) {
      throw new AppError("validation", "range", { ayahTo: ["invalid_range"] });
    }
  }

  const [row] = await db
    .insert(schema.homework)
    .values({
      tutorId: actor.id,
      groupId: input.groupId ?? null,
      studentId: input.studentId ?? null,
      title: input.title,
      instructions: input.instructions ?? null,
      targetType: input.targetType,
      lessonId,
      quizId,
      surah,
      ayahFrom,
      ayahTo,
      dueAt: input.dueAt,
    })
    .returning();

  const recipients = await homeworkRecipients(row!);
  if (recipients.length) {
    await notify(recipients, "homeworkAssigned", { title: input.title }, "/student/homework");
    const parentSets = await Promise.all(recipients.map((s) => parentIdsOf(s)));
    const parents = [...new Set(parentSets.flat())];
    if (parents.length) await notify(parents, "homeworkAssigned", { title: input.title }, "/parent/progress");
  }
  return { id: row!.id };
}

export async function deleteHomework(actor: Actor, homeworkId: string) {
  const hw = await loadOwnedHomework(actor, homeworkId);
  await getDb().delete(schema.homework).where(eq(schema.homework.id, hw.id));
  return { id: hw.id };
}

async function loadOwnedHomework(actor: Actor, homeworkId: string): Promise<HomeworkRow> {
  const hw = await getDb().query.homework.findFirst({ where: eq(schema.homework.id, homeworkId) });
  if (!hw) throw notFound();
  if (actor.role !== "admin" && hw.tutorId !== actor.id) throw forbidden();
  return hw;
}

// ───────────── Tutor lists ─────────────

export type TutorHomeworkRow = HomeworkRow & {
  groupName: string | null;
  studentName: string | null;
  recipients: number;
  submitted: number;
  toReview: number;
};

export async function listTutorHomework(actor: Actor): Promise<TutorHomeworkRow[]> {
  if (actor.role !== "tutor" && actor.role !== "admin") throw forbidden();
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.homework)
    .where(actor.role === "admin" ? undefined : eq(schema.homework.tutorId, actor.id))
    .orderBy(desc(schema.homework.dueAt))
    .limit(200);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [subs, groups, names] = await Promise.all([
    db.select().from(schema.homeworkSubmissions).where(inArray(schema.homeworkSubmissions.homeworkId, ids)),
    db
      .select({ id: schema.classGroups.id, name: schema.classGroups.name })
      .from(schema.classGroups)
      .where(inArray(schema.classGroups.id, rows.map((r) => r.groupId).filter((g): g is string => Boolean(g)).concat("00000000-0000-0000-0000-000000000000"))),
    displayNames(rows.map((r) => r.studentId).filter((s): s is string => Boolean(s))),
  ]);
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const counts = new Map<string, number>();
  await Promise.all(
    rows.map(async (r) => {
      counts.set(r.id, (await homeworkRecipients(r)).length);
    }),
  );
  return rows.map((r) => {
    const mine = subs.filter((s) => s.homeworkId === r.id);
    return {
      ...r,
      groupName: r.groupId ? (groupName.get(r.groupId) ?? null) : null,
      studentName: r.studentId ? (names.get(r.studentId) ?? null) : null,
      recipients: counts.get(r.id) ?? 0,
      submitted: mine.length,
      toReview: mine.filter((s) => s.status === "submitted").length,
    };
  });
}

/** Submissions waiting for the tutor's review, count only (dashboard). */
export async function countHomeworkToReview(actor: Actor): Promise<number> {
  if (actor.role !== "tutor") return 0;
  const rows = await getDb()
    .select({ id: schema.homeworkSubmissions.id })
    .from(schema.homeworkSubmissions)
    .innerJoin(schema.homework, eq(schema.homework.id, schema.homeworkSubmissions.homeworkId))
    .where(and(eq(schema.homework.tutorId, actor.id), eq(schema.homeworkSubmissions.status, "submitted")));
  return rows.length;
}

export type SubmissionRow = typeof schema.homeworkSubmissions.$inferSelect & { studentName: string; attachmentUrl: string | null };

export async function listHomeworkSubmissions(actor: Actor, homeworkId: string): Promise<SubmissionRow[]> {
  const hw = await loadOwnedHomework(actor, homeworkId);
  const subs = await getDb()
    .select()
    .from(schema.homeworkSubmissions)
    .where(eq(schema.homeworkSubmissions.homeworkId, hw.id))
    .orderBy(desc(schema.homeworkSubmissions.submittedAt));
  const names = await displayNames(subs.map((s) => s.studentId));
  return Promise.all(
    subs.map(async (s) => ({
      ...s,
      studentName: names.get(s.studentId) ?? s.studentId,
      attachmentUrl: s.attachmentPath ? await storage().signedUrl("lessonAssets", s.attachmentPath, 600).catch(() => null) : null,
    })),
  );
}

export async function reviewHomeworkSubmission(
  actor: Actor,
  submissionId: string,
  input: { grade: number | null; feedback: string | null; status: "reviewed" | "returned" },
) {
  const db = getDb();
  const sub = await db.query.homeworkSubmissions.findFirst({ where: eq(schema.homeworkSubmissions.id, submissionId) });
  if (!sub) throw notFound();
  await loadOwnedHomework(actor, sub.homeworkId);
  await db
    .update(schema.homeworkSubmissions)
    .set({ grade: input.grade, feedback: input.feedback, status: input.status, reviewedAt: new Date() })
    .where(eq(schema.homeworkSubmissions.id, submissionId));
  return { id: submissionId };
}

// ───────────── Student side ─────────────

export type StudentHomeworkItem = {
  homework: HomeworkRow;
  submission: typeof schema.homeworkSubmissions.$inferSelect | null;
  state: "open" | "overdue" | "submitted" | "reviewed" | "returned";
  lessonTitle: unknown | null;
  surahName: string | null;
};

export function homeworkState(hw: Pick<HomeworkRow, "dueAt">, sub: { status: string } | null, now = new Date()): StudentHomeworkItem["state"] {
  if (sub) return sub.status === "reviewed" ? "reviewed" : sub.status === "returned" ? "returned" : "submitted";
  return hw.dueAt.getTime() < now.getTime() ? "overdue" : "open";
}

export async function studentHomework(actor: Actor, studentId: string): Promise<StudentHomeworkItem[]> {
  if (!(await canAccessStudent(actor as SessionUser, studentId))) throw forbidden();
  const db = getDb();
  const list = await homeworkFor(studentId);
  if (!list.length) return [];
  const [subs, lessons, surahs] = await Promise.all([
    db
      .select()
      .from(schema.homeworkSubmissions)
      .where(and(eq(schema.homeworkSubmissions.studentId, studentId), inArray(schema.homeworkSubmissions.homeworkId, list.map((h) => h.id)))),
    db
      .select({ id: schema.lessons.id, title: schema.lessons.title })
      .from(schema.lessons)
      .where(inArray(schema.lessons.id, list.map((h) => h.lessonId).filter((l): l is string => Boolean(l)).concat("00000000-0000-0000-0000-000000000000"))),
    db.select({ number: schema.quranSurahs.number, name: schema.quranSurahs.nameTranslit }).from(schema.quranSurahs),
  ]);
  const subBy = new Map(subs.map((s) => [s.homeworkId, s]));
  const lessonBy = new Map(lessons.map((l) => [l.id, l.title]));
  const surahBy = new Map(surahs.map((s) => [s.number, s.name]));
  return list.map((hw) => {
    const submission = subBy.get(hw.id) ?? null;
    return {
      homework: hw,
      submission,
      state: homeworkState(hw, submission),
      lessonTitle: hw.lessonId ? (lessonBy.get(hw.lessonId) ?? null) : null,
      surahName: hw.surah ? (surahBy.get(hw.surah) ?? null) : null,
    };
  });
}

async function recordSubmission(
  studentId: string,
  hw: HomeworkRow,
  data: { text?: string | null; attachmentPath?: string | null; quizAttemptId?: string | null; recitationId?: string | null },
) {
  const [row] = await getDb()
    .insert(schema.homeworkSubmissions)
    .values({ homeworkId: hw.id, studentId, status: "submitted", ...data })
    .onConflictDoNothing()
    .returning({ id: schema.homeworkSubmissions.id });
  if (row) {
    await awardXp(studentId, "homework_submitted", HOMEWORK_SUBMITTED_XP, `homework_submitted:${hw.id}`, { homeworkId: hw.id });
  }
  return row ?? null;
}

/** Student (or their parent) submits a free-form homework: text and/or an uploaded attachment. */
export async function submitFreeHomework(
  actor: Actor,
  input: { homeworkId: string; studentId: string; text: string | null; attachmentPath: string | null },
) {
  if (actor.id !== input.studentId && !(actor.role === "parent" && (await isParentOf(actor.id, input.studentId)))) throw forbidden();
  const hw = await getDb().query.homework.findFirst({ where: eq(schema.homework.id, input.homeworkId) });
  if (!hw) throw notFound();
  if (hw.targetType !== "free") throw forbidden();
  if (!(await isHomeworkRecipient(input.studentId, hw))) throw forbidden();
  if (!input.text && !input.attachmentPath) throw new AppError("validation", "empty", { text: ["required"] });
  const row = await recordSubmission(input.studentId, hw, { text: input.text, attachmentPath: input.attachmentPath });
  if (!row) throw conflict("already_submitted");
  return { id: row.id };
}

/** Called by the recitation upload when a recitation is made for a homework. */
export async function satisfyRecitationHomework(studentId: string, homeworkId: string, recitationId: string) {
  const hw = await getDb().query.homework.findFirst({ where: eq(schema.homework.id, homeworkId) });
  if (!hw || hw.targetType !== "recitation") throw new AppError("validation", "homework", { homeworkId: ["not_recitation"] });
  if (!(await isHomeworkRecipient(studentId, hw))) throw forbidden();
  await recordSubmission(studentId, hw, { recitationId });
  return hw;
}

/** Validates (without side effects) that a recitation may be attached to this homework. */
export async function assertRecitationHomework(studentId: string, homeworkId: string) {
  const hw = await getDb().query.homework.findFirst({ where: eq(schema.homework.id, homeworkId) });
  if (!hw || hw.targetType !== "recitation") throw new AppError("validation", "homework", { homeworkId: ["not_recitation"] });
  if (!(await isHomeworkRecipient(studentId, hw))) throw forbidden();
  return hw;
}

/**
 * Lesson homework is auto-satisfied when the lesson is completed. Called from
 * `completeLessonFor` in dal/learn.ts. Never throws (homework must not break lesson completion).
 */
export async function syncLessonHomework(userId: string, lessonId: string): Promise<void> {
  try {
    const list = await homeworkFor(userId);
    for (const hw of list) {
      if (hw.targetType === "lesson" && hw.lessonId === lessonId) await recordSubmission(userId, hw, {});
    }
  } catch (err) {
    console.error("[homework] syncLessonHomework failed", err);
  }
}

// ───────────── Homework quizzes ─────────────

/** The homework (if any) that points at this quiz for this student. */
export async function homeworkForQuiz(studentId: string, quizId: string): Promise<HomeworkRow | null> {
  const list = await homeworkFor(studentId);
  return list.find((h) => h.targetType === "quiz" && h.quizId === quizId) ?? null;
}

/**
 * Authorization for quizzes with kind "homework" (they have no lesson, so the lesson
 * access check does not apply): the student must have homework pointing at the quiz.
 * Staff may always open them. Other quiz kinds pass through untouched.
 * The quiz DAL (getQuizForPlayer and submitQuiz) should call this.
 */
export async function assertHomeworkQuizAccess(actor: Actor, quizId: string): Promise<void> {
  const quiz = await getDb().query.quizzes.findFirst({ where: eq(schema.quizzes.id, quizId), columns: { kind: true } });
  if (!quiz) throw notFound();
  if (quiz.kind !== "homework") return;
  if (actor.role === "admin" || actor.role === "tutor") return;
  if (!(await homeworkForQuiz(actor.id, quizId))) throw forbidden();
}

/** After a quiz attempt: attach it to the student's homework for that quiz (if any). */
export async function linkQuizAttemptToHomework(studentId: string, quizId: string, attemptId: string): Promise<void> {
  const hw = await homeworkForQuiz(studentId, quizId);
  if (!hw) return;
  await recordSubmission(studentId, hw, { quizAttemptId: attemptId });
}

// ───────────── Cron: due soon ─────────────

/**
 * Notifies students (once) about homework due within the next 24h that they have not submitted.
 * Dedupe: a `homeworkDue` notification whose href is `/student/homework?hw=<id>` already exists.
 * Safe to run at any frequency.
 */
export async function runHomeworkDueCron(now = new Date()): Promise<{ checked: number; notified: number }> {
  const db = getDb();
  const until = new Date(now.getTime() + 24 * 3600_000);
  const due = await db
    .select()
    .from(schema.homework)
    .where(and(gt(schema.homework.dueAt, now), lte(schema.homework.dueAt, until)));
  let notified = 0;
  for (const hw of due) {
    const href = `/student/homework?hw=${hw.id}`;
    const recipients = await homeworkRecipients(hw);
    if (!recipients.length) continue;
    const [subs, already] = await Promise.all([
      db
        .select({ studentId: schema.homeworkSubmissions.studentId })
        .from(schema.homeworkSubmissions)
        .where(eq(schema.homeworkSubmissions.homeworkId, hw.id)),
      db
        .select({ userId: schema.notifications.userId })
        .from(schema.notifications)
        .where(and(eq(schema.notifications.type, "homeworkDue"), eq(schema.notifications.href, href))),
    ]);
    const skip = new Set([...subs.map((s) => s.studentId), ...already.map((a) => a.userId)]);
    const targets = recipients.filter((r) => !skip.has(r));
    if (!targets.length) continue;
    await notify(targets, "homeworkDue", { title: hw.title }, href);
    notified += targets.length;
  }
  return { checked: due.length, notified };
}

// Lesson / quiz option lists for the tutor's create dialog.
export async function homeworkTargetOptions(actor: Actor) {
  if (actor.role !== "tutor" && actor.role !== "admin") throw forbidden();
  const db = getDb();
  const [groups, quizzes, lessons] = await Promise.all([
    db
      .select({ id: schema.classGroups.id, name: schema.classGroups.name })
      .from(schema.classGroups)
      .where(actor.role === "admin" ? eq(schema.classGroups.active, true) : and(eq(schema.classGroups.tutorId, actor.id), eq(schema.classGroups.active, true))),
    db.select({ id: schema.quizzes.id, title: schema.quizzes.title }).from(schema.quizzes).where(eq(schema.quizzes.kind, "homework")),
    db
      .select({ id: schema.lessons.id, title: schema.lessons.title, course: schema.courses.title })
      .from(schema.lessons)
      .innerJoin(schema.courses, eq(schema.courses.id, schema.lessons.courseId))
      .where(eq(schema.lessons.published, true))
      .orderBy(schema.courses.slug, schema.lessons.sortOrder)
      .limit(500),
  ]);
  return { groups, quizzes, lessons };
}

