import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { i18n, id, timestamps } from "./_shared";
import { user } from "./auth";

/** Feature modules a program can enable. Subjects are data, not code. */
export type ProgramFeatures = { hifz?: boolean; recitation?: boolean; liveClasses?: boolean; placement?: boolean };

/** Admin-defined subjects (Quran, Arabic Language, Arabic Literature, Tajweed…). */
export const programs = pgTable("programs", {
  id: id(),
  slug: text().notNull().unique(),
  name: i18n().notNull(),
  description: i18n(),
  icon: text(),
  color: text(),
  features: jsonb().$type<ProgramFeatures>().notNull().default({}),
  sortOrder: integer().notNull().default(0),
  published: boolean().notNull().default(false),
  ...timestamps,
});

export const LEVELS = ["beginner", "elementary", "intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];

export const courses = pgTable(
  "courses",
  {
    id: id(),
    programId: uuid()
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    slug: text().notNull().unique(),
    title: i18n().notNull(),
    description: i18n(),
    level: text().$type<Level>().notNull().default("beginner"),
    ageMin: integer(),
    ageMax: integer(),
    coverPath: text(),
    /** Free courses are accessible without subscription/grant. */
    isFree: boolean().notNull().default(false),
    published: boolean().notNull().default(false),
    sortOrder: integer().notNull().default(0),
    createdBy: text().references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index().on(t.programId)],
);

export const units = pgTable(
  "units",
  {
    id: id(),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: i18n().notNull(),
    description: i18n(),
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [index().on(t.courseId)],
);

export const LESSON_TYPES = ["video", "reading", "quiz", "recitation", "live"] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

/** Pedagogical context the tutor provides; fed to the AI studio. */
export type LessonContext = {
  objectives?: string[];
  approach?: string;
  vocabulary?: { term: string; meaning?: string }[];
  ayahRefs?: { surah: number; from: number; to: number }[];
  notes?: string;
};

export const lessons = pgTable(
  "lessons",
  {
    id: id(),
    unitId: uuid()
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    /** Denormalized for cheap access checks. */
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    slug: text().notNull(),
    type: text().$type<LessonType>().notNull().default("video"),
    title: i18n().notNull(),
    summary: i18n(),
    /** Markdown body per locale for reading lessons / notes under a video. */
    body: i18n(),
    videoPath: text(),
    videoDurationSec: integer(),
    context: jsonb().$type<LessonContext>().notNull().default({}),
    /** Preview lessons are viewable without access. */
    isPreview: boolean().notNull().default(false),
    published: boolean().notNull().default(false),
    sortOrder: integer().notNull().default(0),
    xpReward: integer().notNull().default(10),
    ...timestamps,
  },
  (t) => [index().on(t.unitId), index().on(t.courseId), uniqueIndex().on(t.courseId, t.slug)],
);

export const lessonAssets = pgTable(
  "lesson_assets",
  {
    id: id(),
    lessonId: uuid()
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    kind: text().$type<"pdf" | "image" | "audio" | "link" | "worksheet">().notNull(),
    title: i18n().notNull(),
    path: text(),
    url: text(),
    sortOrder: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.lessonId)],
);

export const quizzes = pgTable("quizzes", {
  id: id(),
  /** Null for standalone quizzes (e.g. placement tests). */
  lessonId: uuid().references(() => lessons.id, { onDelete: "cascade" }),
  title: i18n().notNull(),
  kind: text().$type<"lesson" | "placement" | "homework">().notNull().default("lesson"),
  /** 0..1 */
  passScore: real().notNull().default(0.7),
  timeLimitSec: integer(),
  shuffle: boolean().notNull().default(true),
  ...timestamps,
});

export type QuestionType = "single" | "multiple" | "true_false" | "text" | "order" | "match" | "audio_choice";
export type QuestionOption = { id: string; label: { en: string; ar?: string; tr?: string }; audioPath?: string; imagePath?: string };

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: id(),
    quizId: uuid()
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    type: text().$type<QuestionType>().notNull(),
    prompt: i18n().notNull(),
    promptAudioPath: text(),
    options: jsonb().$type<QuestionOption[]>().notNull().default([]),
    /** Option ids, accepted text answers, or ordered ids depending on type. */
    answer: jsonb().$type<string[]>().notNull(),
    explanation: i18n(),
    /** Skill tag used by placement scoring, e.g. "reading", "vocab", "tajweed". */
    skill: text(),
    /** Difficulty 1..5 used by placement scoring. */
    difficulty: integer().notNull().default(1),
    points: integer().notNull().default(1),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [index().on(t.quizId)],
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: id(),
    quizId: uuid()
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    answers: jsonb().$type<Record<string, string[]>>().notNull(),
    score: real().notNull(),
    passed: boolean().notNull(),
    /** Per-skill score 0..1 (placement). */
    skillScores: jsonb().$type<Record<string, number>>(),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.userId), index().on(t.quizId)],
);

/** Maps placement outcomes to course recommendations. Evaluated in priority order. */
export const placementRules = pgTable("placement_rules", {
  id: id(),
  quizId: uuid()
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  /** e.g. { "minScore": 0.4, "maxScore": 0.7, "skills": { "reading": { "min": 0.5 } }, "ageMin": 7, "ageMax": 12 } */
  condition: jsonb()
    .$type<{
      minScore?: number;
      maxScore?: number;
      skills?: Record<string, { min?: number; max?: number }>;
      ageMin?: number;
      ageMax?: number;
    }>()
    .notNull(),
  courseId: uuid()
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  priority: integer().notNull().default(0),
});
