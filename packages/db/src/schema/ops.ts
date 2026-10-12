import { bigint, boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { i18n, id, timestamps } from "./_shared";
import { user } from "./auth";

export const announcements = pgTable("announcements", {
  id: id(),
  title: i18n().notNull(),
  body: i18n().notNull(),
  /** Empty = everyone. */
  audience: text().array().notNull().default([]),
  publishedAt: timestamp({ withTimezone: true }),
  expiresAt: timestamp({ withTimezone: true }),
  createdBy: text().references(() => user.id, { onDelete: "set null" }),
  ...timestamps,
});

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Message key in messages/*.ts under "notifications.*" + params, so it renders in the viewer's locale. */
    type: text().notNull(),
    params: jsonb().$type<Record<string, string | number>>().notNull().default({}),
    href: text(),
    readAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId, t.createdAt)],
);

/**
 * Message threads. Child safety: a thread is always between a parent (or an
 * adult student 18+) and staff. Tutors never message a minor directly -
 * enforced in the DAL (server/dal/messages.ts).
 */
export const messageThreads = pgTable("message_threads", {
  id: id(),
  subject: text().notNull(),
  /** The learner the conversation is about (optional). */
  aboutStudentId: text().references(() => user.id, { onDelete: "set null" }),
  lastMessageAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
});

export const messageThreadMembers = pgTable(
  "message_thread_members",
  {
    threadId: uuid()
      .notNull()
      .references(() => messageThreads.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastReadAt: timestamp({ withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.threadId, t.userId] }), index().on(t.userId)],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    threadId: uuid()
      .notNull()
      .references(() => messageThreads.id, { onDelete: "cascade" }),
    senderId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text().notNull(),
    attachmentPath: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.threadId, t.createdAt)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorId: text().references(() => user.id, { onDelete: "set null" }),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: text(),
    before: jsonb().$type<unknown>(),
    after: jsonb().$type<unknown>(),
    ipAddress: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.entity, t.entityId), index().on(t.createdAt)],
);

/** Runtime-editable settings (WhatsApp number, IBAN, brand overrides, limits…). */
export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: jsonb().$type<unknown>().notNull(),
  updatedBy: text().references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const featureFlags = pgTable("feature_flags", {
  key: text().primaryKey(),
  description: text(),
  enabled: boolean().notNull().default(false),
  /** Empty = all roles. */
  roles: text().array().notNull().default([]),
  /** 0..100 rollout by stable hash of user id. */
  percentage: integer().notNull().default(100),
  /** Explicit user allow-list (always on for these). */
  userIds: text().array().notNull().default([]),
  /** Empty = all programs. */
  programIds: uuid().array().notNull().default([]),
  ...timestamps,
});

/** App-level sliding-window rate limiting (AI endpoints, uploads…). */
export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  key: text().primaryKey(),
  /** Request timestamps (ms) within the current window. */
  hits: bigint({ mode: "number" }).array().notNull().default([]),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
