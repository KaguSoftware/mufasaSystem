import "server-only";
import { z } from "zod";
import { and, asc, desc, eq, getDb, inArray, or, schema, sql, type LessonContext } from "@mufasa/db";
import { sceneDocumentSchema, type SceneDocument } from "@mufasa/video/schema";
import { t18n } from "@mufasa/config/locales";
import { AppError, forbidden, notFound } from "../errors";
import type { SessionUser } from "../session";
import { storage } from "../storage";
import { AGE_BANDS, applyVerbatimAyahs, cleanSceneDocument, collectAyahRefs, type LessonPromptContext } from "@/lib/ai-studio";
import { sanitizeModelText } from "../services/gemini";

export type Conversation = typeof schema.aiConversations.$inferSelect;
export type ChatMessage = typeof schema.aiMessages.$inferSelect;
export type Script = typeof schema.scripts.$inferSelect;
export type VideoProject = typeof schema.videoProjects.$inferSelect;

function assertStaff(actor: SessionUser) {
  if (actor.role !== "tutor" && actor.role !== "admin") throw forbidden();
}
const owns = (actor: SessionUser, ownerId: string) => actor.role === "admin" || actor.id === ownerId;

// ───────────── Lessons for the picker ─────────────

export type StudioLesson = {
  id: string;
  title: string;
  courseTitle: string;
  summary: string | null;
  context: LessonContext;
};

export async function listStudioLessons(actor: SessionUser, locale: string): Promise<StudioLesson[]> {
  assertStaff(actor);
  const rows = await getDb()
    .select({
      id: schema.lessons.id,
      title: schema.lessons.title,
      summary: schema.lessons.summary,
      context: schema.lessons.context,
      courseTitle: schema.courses.title,
    })
    .from(schema.lessons)
    .innerJoin(schema.courses, eq(schema.courses.id, schema.lessons.courseId))
    .orderBy(asc(schema.courses.createdAt), asc(schema.lessons.sortOrder));
  return rows.map((r) => ({
    id: r.id,
    title: t18n(r.title, locale),
    courseTitle: t18n(r.courseTitle, locale),
    summary: r.summary ? t18n(r.summary, locale) : null,
    context: r.context ?? {},
  }));
}

/** Lesson context as the prompt builders want it, with verbatim ayahs from the database. */
export async function getLessonPromptContext(lessonId: string | null, locale: string): Promise<LessonPromptContext | null> {
  if (!lessonId) return null;
  const db = getDb();
  const [lesson] = await db.select().from(schema.lessons).where(eq(schema.lessons.id, lessonId));
  if (!lesson) return null;
  const ctx = lesson.context ?? {};
  const ayahs: NonNullable<LessonPromptContext["ayahs"]> = [];
  for (const ref of (ctx.ayahRefs ?? []).slice(0, 12)) {
    const rows = await db
      .select({ surah: schema.quranAyahs.surah, ayah: schema.quranAyahs.ayah, text: schema.quranAyahs.textUthmani })
      .from(schema.quranAyahs)
      .where(
        and(
          eq(schema.quranAyahs.surah, ref.surah),
          sql`${schema.quranAyahs.ayah} >= ${ref.from}`,
          sql`${schema.quranAyahs.ayah} <= ${ref.to}`,
        ),
      )
      .orderBy(asc(schema.quranAyahs.ayah))
      .limit(30);
    ayahs.push(...rows);
  }
  return {
    title: t18n(lesson.title, locale),
    summary: lesson.summary ? t18n(lesson.summary, locale) : null,
    objectives: ctx.objectives,
    approach: ctx.approach,
    vocabulary: ctx.vocabulary,
    notes: ctx.notes,
    ayahs,
  };
}

export async function lookupAyahs(refs: { surah: number; ayah: number }[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!refs.length) return out;
  const rows = await getDb()
    .select({ surah: schema.quranAyahs.surah, ayah: schema.quranAyahs.ayah, text: schema.quranAyahs.textUthmani })
    .from(schema.quranAyahs)
    .where(or(...refs.map((r) => and(eq(schema.quranAyahs.surah, r.surah), eq(schema.quranAyahs.ayah, r.ayah)))));
  for (const r of rows) out.set(`${r.surah}:${r.ayah}`, r.text);
  return out;
}

// ───────────── Conversations ─────────────

export const createConversationSchema = z.object({
  lessonId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  locale: z.enum(["ar", "en", "tr"]).default("ar"),
  context: z.string().max(20000).nullable().optional(),
  ageBand: z.enum(AGE_BANDS as unknown as [string, ...string[]]).optional(),
});

export const updateConversationSchema = z.object({
  id: z.string().uuid(),
  lessonId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  locale: z.enum(["ar", "en", "tr"]).optional(),
  context: z.string().max(20000).nullable().optional(),
});

export async function listConversations(actor: SessionUser) {
  assertStaff(actor);
  return getDb()
    .select({
      id: schema.aiConversations.id,
      title: schema.aiConversations.title,
      locale: schema.aiConversations.locale,
      lessonId: schema.aiConversations.lessonId,
      ownerId: schema.aiConversations.ownerId,
      ownerName: schema.user.name,
      updatedAt: schema.aiConversations.updatedAt,
    })
    .from(schema.aiConversations)
    .innerJoin(schema.user, eq(schema.user.id, schema.aiConversations.ownerId))
    .where(actor.role === "admin" ? undefined : eq(schema.aiConversations.ownerId, actor.id))
    .orderBy(desc(schema.aiConversations.updatedAt))
    .limit(100);
}

export async function getConversationOwned(actor: SessionUser, id: string): Promise<Conversation> {
  assertStaff(actor);
  const [row] = await getDb().select().from(schema.aiConversations).where(eq(schema.aiConversations.id, id));
  if (!row) throw notFound();
  if (!owns(actor, row.ownerId)) throw forbidden();
  return row;
}

export async function createConversation(actor: SessionUser, input: z.infer<typeof createConversationSchema>) {
  assertStaff(actor);
  const [row] = await getDb()
    .insert(schema.aiConversations)
    .values({
      ownerId: actor.id,
      lessonId: input.lessonId ?? null,
      title: input.title ?? "Untitled",
      locale: input.locale,
      context: input.context ?? null,
    })
    .returning({ id: schema.aiConversations.id });
  return row!;
}

export async function updateConversation(actor: SessionUser, input: z.infer<typeof updateConversationSchema>) {
  await getConversationOwned(actor, input.id);
  const { id, ...rest } = input;
  const set: Partial<typeof schema.aiConversations.$inferInsert> = {};
  if (rest.lessonId !== undefined) set.lessonId = rest.lessonId;
  if (rest.title !== undefined) set.title = rest.title;
  if (rest.locale !== undefined) set.locale = rest.locale;
  if (rest.context !== undefined) set.context = rest.context;
  if (Object.keys(set).length) await getDb().update(schema.aiConversations).set(set).where(eq(schema.aiConversations.id, id));
}

export async function deleteConversation(actor: SessionUser, id: string) {
  await getConversationOwned(actor, id);
  await getDb().delete(schema.aiConversations).where(eq(schema.aiConversations.id, id));
}

export async function getConversationDetail(actor: SessionUser, id: string) {
  const conversation = await getConversationOwned(actor, id);
  const db = getDb();
  const [messages, scripts, projects] = await Promise.all([
    db.select().from(schema.aiMessages).where(eq(schema.aiMessages.conversationId, id)).orderBy(asc(schema.aiMessages.createdAt)),
    db.select().from(schema.scripts).where(eq(schema.scripts.conversationId, id)).orderBy(desc(schema.scripts.version)),
    db
      .select({ id: schema.videoProjects.id, title: schema.videoProjects.title, status: schema.videoProjects.status, scriptId: schema.videoProjects.scriptId })
      .from(schema.videoProjects)
      .innerJoin(schema.scripts, eq(schema.scripts.id, schema.videoProjects.scriptId))
      .where(eq(schema.scripts.conversationId, id))
      .orderBy(desc(schema.videoProjects.updatedAt)),
  ]);
  return { conversation, messages, scripts, projects };
}

export async function loadHistory(actor: SessionUser, conversationId: string, limit = 40) {
  const conversation = await getConversationOwned(actor, conversationId);
  const rows = await getDb()
    .select()
    .from(schema.aiMessages)
    .where(eq(schema.aiMessages.conversationId, conversationId))
    .orderBy(desc(schema.aiMessages.createdAt))
    .limit(limit);
  return { conversation, history: rows.reverse() };
}

export async function appendMessage(
  conversationId: string,
  role: "user" | "model",
  content: string,
  tokens?: { tokensIn?: number | null; tokensOut?: number | null },
) {
  const db = getDb();
  await db.insert(schema.aiMessages).values({
    conversationId,
    role,
    content,
    tokensIn: tokens?.tokensIn ?? null,
    tokensOut: tokens?.tokensOut ?? null,
  });
  await db.update(schema.aiConversations).set({ updatedAt: new Date() }).where(eq(schema.aiConversations.id, conversationId));
}

// ───────────── Scripts ─────────────

export const saveScriptSchema = z.object({
  conversationId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(60000),
});
export const updateScriptSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(60000),
});

export async function getScriptOwned(actor: SessionUser, id: string): Promise<Script> {
  assertStaff(actor);
  const [row] = await getDb().select().from(schema.scripts).where(eq(schema.scripts.id, id));
  if (!row) throw notFound();
  if (!owns(actor, row.createdBy)) throw forbidden();
  return row;
}

/** New version (max + 1 within the conversation). */
export async function saveScript(actor: SessionUser, input: z.infer<typeof saveScriptSchema>) {
  const conversation = await getConversationOwned(actor, input.conversationId);
  const db = getDb();
  const [last] = await db
    .select({ v: sql<number>`coalesce(max(${schema.scripts.version}), 0)` })
    .from(schema.scripts)
    .where(eq(schema.scripts.conversationId, conversation.id));
  const [row] = await db
    .insert(schema.scripts)
    .values({
      conversationId: conversation.id,
      lessonId: conversation.lessonId,
      version: (last?.v ?? 0) + 1,
      locale: conversation.locale,
      title: input.title,
      content: input.content,
      createdBy: actor.id,
    })
    .returning({ id: schema.scripts.id, version: schema.scripts.version });
  return row!;
}

export async function updateScript(actor: SessionUser, input: z.infer<typeof updateScriptSchema>) {
  const script = await getScriptOwned(actor, input.id);
  if (script.status === "approved") throw new AppError("conflict", "Approved scripts are locked. Save a new version instead.");
  await getDb().update(schema.scripts).set({ title: input.title, content: input.content }).where(eq(schema.scripts.id, input.id));
}

/** Approving one version archives the other approved versions of the same conversation. */
export async function approveScript(actor: SessionUser, id: string) {
  const script = await getScriptOwned(actor, id);
  const db = getDb();
  if (script.conversationId) {
    await db
      .update(schema.scripts)
      .set({ status: "archived" })
      .where(and(eq(schema.scripts.conversationId, script.conversationId), eq(schema.scripts.status, "approved")));
  }
  await db
    .update(schema.scripts)
    .set({ status: "approved", approvedBy: actor.id, approvedAt: new Date() })
    .where(eq(schema.scripts.id, id));
}

// ───────────── Projects ─────────────

export async function getProjectOwned(actor: SessionUser, id: string): Promise<VideoProject> {
  assertStaff(actor);
  const [row] = await getDb().select().from(schema.videoProjects).where(eq(schema.videoProjects.id, id));
  if (!row) throw notFound();
  if (!owns(actor, row.createdBy)) throw forbidden();
  return row;
}

export async function listProjects(actor: SessionUser) {
  assertStaff(actor);
  return getDb()
    .select({
      id: schema.videoProjects.id,
      title: schema.videoProjects.title,
      status: schema.videoProjects.status,
      locale: schema.videoProjects.locale,
      updatedAt: schema.videoProjects.updatedAt,
      createdBy: schema.videoProjects.createdBy,
    })
    .from(schema.videoProjects)
    .where(actor.role === "admin" ? undefined : eq(schema.videoProjects.createdBy, actor.id))
    .orderBy(desc(schema.videoProjects.updatedAt))
    .limit(100);
}

export async function createProject(actor: SessionUser, script: Script) {
  const [row] = await getDb()
    .insert(schema.videoProjects)
    .values({ scriptId: script.id, lessonId: script.lessonId, title: script.title, locale: script.locale, createdBy: actor.id })
    .returning({ id: schema.videoProjects.id });
  return row!;
}

export const updateScenesSchema = z.object({ projectId: z.string().uuid(), sceneJson: z.unknown(), title: z.string().trim().min(1).max(200).optional() });

/**
 * Save the tutor's edited scene JSON. Voice clips are kept only for scenes whose
 * narration did not change (a changed line needs a fresh TTS pass).
 */
export async function updateProjectScenes(actor: SessionUser, input: z.infer<typeof updateScenesSchema>) {
  const project = await getProjectOwned(actor, input.projectId);
  const parsed = sceneDocumentSchema.safeParse(input.sceneJson);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const i of parsed.error.issues) (fieldErrors[i.path.join(".") || "_"] ??= []).push(i.message);
    throw new AppError("validation", "Invalid scene JSON", fieldErrors);
  }
  // Quranic text always comes from the database, whatever the editor typed.
  const verbatim = applyVerbatimAyahs(parsed.data, await lookupAyahs(collectAyahRefs(parsed.data)));
  const next = cleanSceneDocument(verbatim.doc, sanitizeModelText);
  const prev = sceneDocumentSchema.safeParse(project.sceneJson);
  const prevNarration = new Map((prev.success ? prev.data.scenes : []).map((s) => [s.id, s.narration]));
  const audio: VideoProject["audio"] = {};
  const scenes = next.scenes.map((s) => {
    const keep = project.audio[s.id] && prevNarration.get(s.id) === s.narration;
    if (keep) {
      audio[s.id] = project.audio[s.id]!;
      return { ...s, durationSec: project.audio[s.id]!.durationSec };
    }
    return { ...s, durationSec: undefined };
  });
  const allVoiced = scenes.every((s) => audio[s.id]);
  // running jobs keep their status; any edit invalidates a rendered or published output
  const busy = project.status === "voicing" || project.status === "rendering";
  const status: VideoProject["status"] = busy ? project.status : allVoiced ? "voiced" : "scenes_ready";
  await getDb()
    .update(schema.videoProjects)
    .set({ sceneJson: { ...next, scenes }, audio, title: input.title ?? project.title, status })
    .where(eq(schema.videoProjects.id, project.id));
  return { warnings: verbatim.warnings };
}

export type ProjectView = {
  project: VideoProject;
  doc: SceneDocument | null;
  audioUrls: Record<string, { src: string; durationSec: number }>;
  outputUrl: string | null;
  lesson: { id: string; title: string } | null;
};

async function safeSigned(bucket: "ttsAudio" | "lessonVideos", path: string): Promise<string | null> {
  try {
    return await storage().signedUrl(bucket, path, 60 * 60 * 3);
  } catch {
    return null;
  }
}

export async function getProjectView(actor: SessionUser, id: string, locale: string): Promise<ProjectView> {
  const project = await getProjectOwned(actor, id);
  const parsed = sceneDocumentSchema.safeParse(project.sceneJson);
  const audioUrls: ProjectView["audioUrls"] = {};
  await Promise.all(
    Object.entries(project.audio).map(async ([sceneId, clip]) => {
      const src = await safeSigned("ttsAudio", clip.path);
      if (src) audioUrls[sceneId] = { src, durationSec: clip.durationSec };
    }),
  );
  const outputUrl = project.outputPath ? await safeSigned("lessonVideos", project.outputPath) : null;
  let lesson: ProjectView["lesson"] = null;
  if (project.lessonId) {
    const [l] = await getDb().select({ id: schema.lessons.id, title: schema.lessons.title }).from(schema.lessons).where(eq(schema.lessons.id, project.lessonId));
    if (l) lesson = { id: l.id, title: t18n(l.title, locale) };
  }
  return { project, doc: parsed.success ? parsed.data : null, audioUrls, outputUrl, lesson };
}

export type ProjectStatusView = {
  status: VideoProject["status"];
  job: { id: string; kind: string; status: string; progress: number; error: string | null } | null;
  outputUrl: string | null;
};

/** Polled by the project page every few seconds: project status plus the newest job's progress. */
export async function getProjectStatus(actor: SessionUser, projectId: string): Promise<ProjectStatusView> {
  const project = await getProjectOwned(actor, projectId);
  const [job] = await getDb()
    .select({ id: schema.jobs.id, kind: schema.jobs.kind, status: schema.jobs.status, progress: schema.jobs.progress, error: schema.jobs.error })
    .from(schema.jobs)
    .where(and(sql`${schema.jobs.payload}->>'projectId' = ${projectId}`, inArray(schema.jobs.kind, ["tts_project", "render_video"])))
    .orderBy(desc(schema.jobs.createdAt))
    .limit(1);
  const outputUrl =
    project.outputPath && (project.status === "rendered" || project.status === "published")
      ? await safeSigned("lessonVideos", project.outputPath)
      : null;
  return { status: project.status, job: job ?? null, outputUrl };
}
