import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { i18n, id, timestamps } from "./_shared";
import { user } from "./auth";
import { courses, lessons, quizzes } from "./catalog";
import { classGroups } from "./live";

export const enrollments = pgTable(
  "enrollments",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    source: text().$type<"self" | "parent" | "tutor" | "admin" | "placement">().notNull().default("self"),
    enrolledAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp({ withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.courseId] })],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonId: uuid()
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    /** Furthest watched position in seconds. */
    positionSec: integer().notNull().default(0),
    /** 0..100 */
    percent: integer().notNull().default(0),
    completedAt: timestamp({ withTimezone: true }),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] }), index().on(t.userId, t.courseId)],
);

// ───────────── Gamification ─────────────

export const XP_REASONS = [
  "lesson_completed",
  "quiz_passed",
  "recitation_submitted",
  "recitation_approved",
  "hifz_memorized",
  "class_attended",
  "homework_submitted",
  "streak_bonus",
  "admin_adjustment",
] as const;
export type XpReason = (typeof XP_REASONS)[number];

export const xpEvents = pgTable(
  "xp_events",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: text().$type<XpReason>().notNull(),
    amount: integer().notNull(),
    /** Idempotency key: e.g. "lesson_completed:<lessonId>" so XP is never double-awarded. */
    refKey: text(),
    meta: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId, t.createdAt), uniqueIndex().on(t.userId, t.refKey)],
);

export const streaks = pgTable("streaks", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  current: integer().notNull().default(0),
  longest: integer().notNull().default(0),
  /** Local calendar date (user's timezone) of the last qualifying activity. */
  lastActiveDate: date({ mode: "string" }),
  freezesAvailable: integer().notNull().default(1),
  /** ISO week ("2026-W41") in which the freeze allowance was last refilled. */
  freezeWeek: text(),
  totalXp: integer().notNull().default(0),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Badge rule evaluated by the gamification engine after each XP event. */
export type BadgeRule =
  | { type: "streak"; days: number }
  | { type: "total_xp"; amount: number }
  | { type: "count"; reason: XpReason; count: number }
  | { type: "course_completed"; courseId?: string }
  | { type: "hifz_ayahs"; count: number };

export const badges = pgTable("badges", {
  id: id(),
  slug: text().notNull().unique(),
  name: i18n().notNull(),
  description: i18n(),
  icon: text().notNull().default("star"),
  rule: jsonb().$type<BadgeRule>().notNull(),
  active: boolean().notNull().default(true),
  ...timestamps,
});

export const userBadges = pgTable(
  "user_badges",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    badgeId: uuid()
      .notNull()
      .references(() => badges.id, { onDelete: "cascade" }),
    awardedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.badgeId] })],
);

export const certificates = pgTable(
  "certificates",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: uuid().references(() => courses.id, { onDelete: "set null" }),
    /** Public verification code shown on the PDF (/verify/[code]). */
    code: text().notNull().unique(),
    title: i18n().notNull(),
    recipientName: text().notNull(),
    pdfPath: text(),
    issuedBy: text().references(() => user.id, { onDelete: "set null" }),
    issuedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.userId)],
);

// ───────────── Homework ─────────────

export const homework = pgTable(
  "homework",
  {
    id: id(),
    tutorId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Either a group or a single student is targeted. */
    groupId: uuid().references(() => classGroups.id, { onDelete: "cascade" }),
    studentId: text().references(() => user.id, { onDelete: "cascade" }),
    title: text().notNull(),
    instructions: text(),
    targetType: text().$type<"lesson" | "quiz" | "recitation" | "free">().notNull(),
    lessonId: uuid().references(() => lessons.id, { onDelete: "set null" }),
    quizId: uuid().references(() => quizzes.id, { onDelete: "set null" }),
    /** For recitation homework. */
    surah: integer(),
    ayahFrom: integer(),
    ayahTo: integer(),
    dueAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index().on(t.groupId), index().on(t.studentId), index().on(t.tutorId)],
);

export const homeworkSubmissions = pgTable(
  "homework_submissions",
  {
    id: id(),
    homeworkId: uuid()
      .notNull()
      .references(() => homework.id, { onDelete: "cascade" }),
    studentId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text().$type<"submitted" | "reviewed" | "returned">().notNull().default("submitted"),
    text: text(),
    attachmentPath: text(),
    /** Links to the artefact that satisfies it. */
    quizAttemptId: uuid(),
    recitationId: uuid(),
    grade: integer(),
    feedback: text(),
    submittedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp({ withTimezone: true }),
  },
  (t) => [uniqueIndex().on(t.homeworkId, t.studentId)],
);
