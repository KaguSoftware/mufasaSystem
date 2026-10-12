import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_shared";
import { user } from "./auth";
import { lessons } from "./catalog";

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: id(),
    ownerId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonId: uuid().references(() => lessons.id, { onDelete: "set null" }),
    title: text().notNull().default("Untitled"),
    /** Locale of the script being written. */
    locale: text().notNull().default("ar"),
    /** Extra free-form context the tutor pasted (full lesson plan, approach…). */
    context: text(),
    ...timestamps,
  },
  (t) => [index().on(t.ownerId)],
);

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: id(),
    conversationId: uuid()
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: text().$type<"user" | "model">().notNull(),
    content: text().notNull(),
    tokensIn: integer(),
    tokensOut: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.conversationId, t.createdAt)],
);

export const scripts = pgTable(
  "scripts",
  {
    id: id(),
    conversationId: uuid().references(() => aiConversations.id, { onDelete: "set null" }),
    lessonId: uuid().references(() => lessons.id, { onDelete: "set null" }),
    version: integer().notNull().default(1),
    locale: text().notNull().default("ar"),
    title: text().notNull(),
    content: text().notNull(),
    status: text().$type<"draft" | "approved" | "archived">().notNull().default("draft"),
    createdBy: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    approvedBy: text().references(() => user.id, { onDelete: "set null" }),
    approvedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index().on(t.lessonId)],
);

export const mascots = pgTable("mascots", {
  id: id(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  /** Map of pose name → asset path (SVG/PNG) in the public-assets bucket or /public. */
  poses: jsonb().$type<Record<string, string>>().notNull(),
  defaultVoice: text(),
  ...timestamps,
});

export type VideoProjectStatus =
  | "draft"
  | "scenes_ready"
  | "voicing"
  | "voiced"
  | "rendering"
  | "rendered"
  | "published"
  | "failed";

export const videoProjects = pgTable(
  "video_projects",
  {
    id: id(),
    lessonId: uuid().references(() => lessons.id, { onDelete: "set null" }),
    scriptId: uuid().references(() => scripts.id, { onDelete: "set null" }),
    mascotId: uuid().references(() => mascots.id, { onDelete: "set null" }),
    title: text().notNull(),
    locale: text().notNull().default("ar"),
    voice: text(),
    /** Validated against packages/video `sceneDocumentSchema`. */
    sceneJson: jsonb().$type<unknown>(),
    /** sceneId → storage path of the TTS clip + duration. */
    audio: jsonb().$type<Record<string, { path: string; durationSec: number }>>().notNull().default({}),
    status: text().$type<VideoProjectStatus>().notNull().default("draft"),
    outputPath: text(),
    durationSec: integer(),
    createdBy: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index().on(t.lessonId)],
);

/**
 * Generic job queue consumed by apps/render-worker (and cron).
 * Claimed with SELECT … FOR UPDATE SKIP LOCKED.
 */
export type JobKind = "render_video" | "tts_project" | "recitation_ai" | "certificate_pdf" | "data_export" | "email";

export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    kind: text().$type<JobKind>().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    status: text().$type<"queued" | "running" | "succeeded" | "failed" | "cancelled">().notNull().default("queued"),
    /** 0..100 */
    progress: integer().notNull().default(0),
    attempts: integer().notNull().default(0),
    maxAttempts: integer().notNull().default(3),
    runAfter: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp({ withTimezone: true }),
    lockedBy: text(),
    result: jsonb().$type<Record<string, unknown>>(),
    error: text(),
    /** Optional dedupe key, e.g. "recitation_ai:<id>". */
    dedupeKey: text(),
    ...timestamps,
  },
  (t) => [index().on(t.status, t.runAfter), uniqueIndex().on(t.dedupeKey)],
);
