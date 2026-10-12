import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { user } from "./auth";

export const profiles = pgTable("profiles", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** First name / nickname only for minors (child safety: no surnames shown). */
  displayName: text().notNull(),
  avatarPath: text(),
  /** Birth year only: we deliberately do not store full birth dates. */
  birthYear: integer(),
  country: text(),
  phone: text(),
  whatsapp: text(),
  bio: text(),
  ...timestamps,
});

/** Parent ↔ child relationship. A child can have more than one guardian. */
export const parentChildren = pgTable(
  "parent_children",
  {
    parentId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    childId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    relation: text().notNull().default("parent"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.parentId, t.childId] }), index().on(t.childId)],
);

export type WeeklyAvailability = { day: 0 | 1 | 2 | 3 | 4 | 5 | 6; start: string; end: string }[];

export const tutorProfiles = pgTable("tutor_profiles", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  headline: text(),
  bio: text(),
  languages: text().array().notNull().default([]),
  specialties: text().array().notNull().default([]),
  /** Recurring weekly slots in the tutor's timezone, "HH:mm". */
  availability: jsonb().$type<WeeklyAvailability>().notNull().default([]),
  isPublic: boolean().notNull().default(true),
  ...timestamps,
});

/** Tutor ↔ student assignment (who reviews whose recitations/homework). */
export const tutorStudents = pgTable(
  "tutor_students",
  {
    tutorId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    studentId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    programId: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tutorId, t.studentId] }), index().on(t.studentId)],
);

export const parentalConsents = pgTable(
  "parental_consents",
  {
    id: id(),
    parentId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    childId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Version of the consent/privacy text accepted, e.g. "2026-10-01". */
    policyVersion: text().notNull(),
    allowLiveVideo: boolean().notNull().default(true),
    allowRecitationRecording: boolean().notNull().default(true),
    allowAiFeedback: boolean().notNull().default(true),
    allowSessionRecording: boolean().notNull().default(false),
    ipAddress: text(),
    userAgent: text(),
    acceptedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.childId)],
);

export const dataRequests = pgTable("data_requests", {
  id: id(),
  /** The account whose data is requested (may be a child). */
  subjectUserId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  requestedBy: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: text().$type<"export" | "delete">().notNull(),
  status: text().$type<"pending" | "approved" | "rejected" | "completed">().notNull().default("pending"),
  resultPath: text(),
  reviewedBy: text().references(() => user.id, { onDelete: "set null" }),
  note: text(),
  ...timestamps,
});
