import { index, integer, jsonb, pgTable, primaryKey, real, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { user } from "./auth";

export const quranSurahs = pgTable("quran_surahs", {
  number: smallint().primaryKey(),
  nameAr: text().notNull(),
  nameEn: text().notNull(),
  nameTranslit: text().notNull(),
  ayahCount: smallint().notNull(),
  revelation: text().$type<"meccan" | "medinan">().notNull(),
});

/**
 * Full Quran text (Uthmani). Seeded from the Tanzil dataset: see
 * packages/db/src/seed/quran.ts for source + attribution requirements.
 */
export const quranAyahs = pgTable(
  "quran_ayahs",
  {
    surah: smallint()
      .notNull()
      .references(() => quranSurahs.number),
    ayah: smallint().notNull(),
    textUthmani: text().notNull(),
    /** Diacritics-stripped text used for the deterministic word diff. */
    textSimple: text().notNull(),
    juz: smallint(),
    page: smallint(),
  },
  (t) => [primaryKey({ columns: [t.surah, t.ayah] })],
);

export const hifzPlans = pgTable(
  "hifz_plans",
  {
    id: id(),
    studentId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tutorId: text().references(() => user.id, { onDelete: "set null" }),
    title: text().notNull(),
    /** Target range, inclusive. */
    fromSurah: smallint().notNull(),
    fromAyah: smallint().notNull().default(1),
    toSurah: smallint().notNull(),
    toAyah: smallint(),
    /** New ayahs per week. */
    weeklyTarget: integer().notNull().default(5),
    direction: text().$type<"forward" | "backward">().notNull().default("backward"),
    status: text().$type<"active" | "paused" | "completed">().notNull().default("active"),
    ...timestamps,
  },
  (t) => [index().on(t.studentId)],
);

export const HIFZ_STATUSES = ["learning", "memorized", "needs_review"] as const;
export type HifzStatus = (typeof HIFZ_STATUSES)[number];

export const hifzEntries = pgTable(
  "hifz_entries",
  {
    id: id(),
    studentId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    planId: uuid().references(() => hifzPlans.id, { onDelete: "set null" }),
    surah: smallint().notNull(),
    ayahFrom: smallint().notNull(),
    ayahTo: smallint().notNull(),
    status: text().$type<HifzStatus>().notNull().default("learning"),
    /** 1..5 tutor grade. */
    grade: smallint(),
    tutorId: text().references(() => user.id, { onDelete: "set null" }),
    note: text(),
    lastReviewedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index().on(t.studentId, t.surah)],
);

export const recitationSubmissions = pgTable(
  "recitation_submissions",
  {
    id: id(),
    studentId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    hifzEntryId: uuid().references(() => hifzEntries.id, { onDelete: "set null" }),
    homeworkId: uuid(),
    surah: smallint().notNull(),
    ayahFrom: smallint().notNull(),
    ayahTo: smallint().notNull(),
    /** Private bucket "recitations". */
    audioPath: text().notNull(),
    durationSec: integer(),
    status: text().$type<"pending" | "reviewed" | "needs_redo">().notNull().default("pending"),
    tutorId: text().references(() => user.id, { onDelete: "set null" }),
    tutorScore: smallint(),
    tutorFeedback: text(),
    reviewedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index().on(t.studentId), index().on(t.status)],
);

export type AiWordIssue = {
  index: number;
  expected?: string;
  heard?: string;
  kind: "missing" | "extra" | "mispronounced";
};
export type AiTajweedNote = { rule: string; word?: string; note: string; severity: "info" | "minor" | "major" };

/** AI-assisted feedback. Advisory only: the tutor grade is authoritative. */
export const recitationAiFeedback = pgTable("recitation_ai_feedback", {
  recitationId: uuid()
    .primaryKey()
    .references(() => recitationSubmissions.id, { onDelete: "cascade" }),
  status: text().$type<"queued" | "processing" | "done" | "failed">().notNull().default("queued"),
  model: text(),
  transcript: text(),
  /** Deterministic accuracy from server-side word diff, 0..1. */
  accuracy: real(),
  wordIssues: jsonb().$type<AiWordIssue[]>(),
  tajweedNotes: jsonb().$type<AiTajweedNote[]>(),
  summary: text(),
  /** Model self-reported confidence 0..1. */
  confidence: real(),
  error: text(),
  ...timestamps,
});
