import { boolean, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { user } from "./auth";
import { courses, programs } from "./catalog";

export const classGroups = pgTable(
  "class_groups",
  {
    id: id(),
    name: text().notNull(),
    tutorId: text()
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    programId: uuid().references(() => programs.id, { onDelete: "set null" }),
    courseId: uuid().references(() => courses.id, { onDelete: "set null" }),
    capacity: integer().notNull().default(8),
    ageMin: integer(),
    ageMax: integer(),
    active: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [index().on(t.tutorId)],
);

export const classGroupMembers = pgTable(
  "class_group_members",
  {
    groupId: uuid()
      .notNull()
      .references(() => classGroups.id, { onDelete: "cascade" }),
    studentId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.studentId] }), index().on(t.studentId)],
);

export type SessionMode = "livekit" | "external_link";

export const classSessions = pgTable(
  "class_sessions",
  {
    id: id(),
    /** Group session, or 1:1 when bookingId is set. */
    groupId: uuid().references(() => classGroups.id, { onDelete: "cascade" }),
    tutorId: text()
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    title: text().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    durationMin: integer().notNull().default(45),
    mode: text().$type<SessionMode>().notNull().default("external_link"),
    /** Meet/Zoom URL when mode = external_link. */
    meetingUrl: text(),
    /** LiveKit room name when mode = livekit (generated). */
    roomName: text().unique(),
    status: text().$type<"scheduled" | "live" | "ended" | "cancelled">().notNull().default("scheduled"),
    /** Child safety: only true when every attendee's parent allowed recording. */
    recordingAllowed: boolean().notNull().default(false),
    tutorJoinedAt: timestamp({ withTimezone: true }),
    endedAt: timestamp({ withTimezone: true }),
    reminderSentAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index().on(t.groupId), index().on(t.tutorId, t.startsAt), index().on(t.startsAt)],
);

export const sessionAttendees = pgTable(
  "session_attendees",
  {
    sessionId: uuid()
      .notNull()
      .references(() => classSessions.id, { onDelete: "cascade" }),
    studentId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text().$type<"expected" | "present" | "late" | "absent" | "excused">().notNull().default("expected"),
    /** Set from LiveKit participant_joined / participant_left webhooks. */
    joinedAt: timestamp({ withTimezone: true }),
    leftAt: timestamp({ withTimezone: true }),
    secondsPresent: integer().notNull().default(0),
    markedBy: text().$type<"tutor" | "livekit" | "system">(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.studentId] }), index().on(t.studentId)],
);

/** One-off overrides on top of tutor_profiles.availability (holidays, extra slots). */
export const tutorAvailabilityExceptions = pgTable(
  "tutor_availability_exceptions",
  {
    id: id(),
    tutorId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    kind: text().$type<"unavailable" | "extra">().notNull(),
  },
  (t) => [index().on(t.tutorId, t.startsAt)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    tutorId: text()
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    studentId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    bookedBy: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: uuid().references(() => classSessions.id, { onDelete: "set null" }),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    durationMin: integer().notNull().default(30),
    status: text().$type<"pending" | "confirmed" | "cancelled" | "completed">().notNull().default("pending"),
    note: text(),
    ...timestamps,
  },
  (t) => [index().on(t.tutorId, t.startsAt), index().on(t.studentId)],
);
