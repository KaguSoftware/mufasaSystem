import "server-only";
import { and, asc, desc, eq, getDb, gte, inArray, lte, schema, type HifzStatus } from "@mufasa/db";
import { isConfigured } from "@/env";
import { isValidRange } from "@/lib/hifz-ranges";
import { checkRecitationFile, MAX_RECITATION_SECONDS } from "@/lib/recitation-upload";
import { AppError, forbidden, notFound } from "../errors";
import { isEnabled } from "../flags";
import { enqueueJob } from "../jobs";
import { notify } from "../notify";
import { enforceRateLimit } from "../rate-limit";
import { awardXp } from "../services/gamification";
import { canAccessStudent, isParentOf, isTutorOf, type SessionUser } from "../session";
import { objectPath, storage } from "../storage";
import { childAllows } from "./family";
import { updateEntry } from "./hifz";
import { assertRecitationHomework, satisfyRecitationHomework, studentHomework } from "./homework";
import { displayNames, listSurahs, parentIdsOf, surahCounts, tutorStudentIds } from "./tutoring";

type Actor = Pick<SessionUser, "id" | "role">;
type Recitation = typeof schema.recitationSubmissions.$inferSelect;

export const RECITATION_SUBMITTED_XP = 5;
export const RECITATION_APPROVED_XP = 20;
export const APPROVAL_MIN_SCORE = 3;

// ───────────── Submit ─────────────

export type CreateRecitationInput = {
  studentId: string;
  surah: number;
  ayahFrom: number;
  ayahTo: number;
  hifzEntryId?: string | null;
  homeworkId?: string | null;
  durationSec?: number | null;
  requestAi: boolean;
  file: { bytes: Uint8Array; type: string; size: number };
};

/** Student (self) or a parent (for their child) submits a recitation. */
export async function createRecitation(actor: SessionUser, input: CreateRecitationInput) {
  const isSelf = actor.id === input.studentId && actor.role === "student";
  if (!isSelf && !(actor.role === "parent" && (await isParentOf(actor.id, input.studentId)))) throw forbidden();
  if (!(await childAllows(input.studentId, "allowRecitationRecording"))) throw forbidden("recording_not_allowed");

  const counts = await surahCounts();
  if (!isValidRange({ surah: input.surah, from: input.ayahFrom, to: input.ayahTo }, counts)) {
    throw new AppError("validation", "range", { ayahTo: ["invalid_range"] });
  }
  const check = checkRecitationFile(input.file);
  if (!check.ok) throw new AppError("validation", "file", { file: [check.reason] });
  if (input.durationSec && input.durationSec > MAX_RECITATION_SECONDS + 5) {
    throw new AppError("validation", "duration", { file: ["too_long"] });
  }

  const db = getDb();
  if (input.hifzEntryId) {
    const entry = await db.query.hifzEntries.findFirst({
      where: and(eq(schema.hifzEntries.id, input.hifzEntryId), eq(schema.hifzEntries.studentId, input.studentId)),
      columns: { id: true },
    });
    if (!entry) throw forbidden();
  }
  if (input.homeworkId) await assertRecitationHomework(input.studentId, input.homeworkId);

  const path = objectPath(`recitations/${input.studentId}`, check.ext);
  await storage().upload("recitations", path, input.file.bytes, check.mime);

  const [row] = await db
    .insert(schema.recitationSubmissions)
    .values({
      studentId: input.studentId,
      hifzEntryId: input.hifzEntryId ?? null,
      homeworkId: input.homeworkId ?? null,
      surah: input.surah,
      ayahFrom: input.ayahFrom,
      ayahTo: input.ayahTo,
      audioPath: path,
      durationSec: input.durationSec ? Math.round(input.durationSec) : null,
    })
    .returning({ id: schema.recitationSubmissions.id });
  const id = row!.id;

  await awardXp(input.studentId, "recitation_submitted", RECITATION_SUBMITTED_XP, `recitation_submitted:${id}`, { recitationId: id });
  if (input.homeworkId) await satisfyRecitationHomework(input.studentId, input.homeworkId, id);

  const aiQueued = input.requestAi ? await queueAiFeedback(actor, input.studentId, id, { silent: true }) : false;
  return { id, aiQueued };
}

/**
 * Queues the recitation_ai job when: flag on, Gemini configured, parent consent allows AI
 * feedback, and the per-user AI rate limit has room. With `silent`, a refusal returns false
 * instead of throwing (the recitation itself was already saved).
 */
async function queueAiFeedback(actor: Actor, studentId: string, recitationId: string, opts: { silent: boolean }): Promise<boolean> {
  try {
    if (!(await isEnabled("ai_recitation_feedback", actor))) throw new AppError("feature_disabled", "ai_recitation_feedback");
    if (!isConfigured("gemini")) throw new AppError("integration_not_configured", "Gemini");
    if (!(await childAllows(studentId, "allowAiFeedback"))) throw forbidden("ai_not_allowed");
    await enforceRateLimit("ai.recitation", actor.id, actor.role);
  } catch (err) {
    if (opts.silent && err instanceof AppError) return false;
    throw err;
  }
  await getDb()
    .insert(schema.recitationAiFeedback)
    .values({ recitationId, status: "queued" })
    .onConflictDoUpdate({ target: schema.recitationAiFeedback.recitationId, set: { status: "queued", error: null } });
  await enqueueJob("recitation_ai", { recitationId }, { dedupeKey: `recitation_ai:${recitationId}` });
  return true;
}

/** Retry / request AI feedback for an existing recitation (student, parent, tutor of the student, admin). */
export async function requestAiFeedback(actor: SessionUser, recitationId: string) {
  const rec = await loadRecitation(recitationId);
  if (!(await canAccessStudent(actor, rec.studentId))) throw forbidden();
  await queueAiFeedback(actor, rec.studentId, recitationId, { silent: false });
  return { id: recitationId };
}

async function loadRecitation(id: string): Promise<Recitation> {
  const rec = await getDb().query.recitationSubmissions.findFirst({ where: eq(schema.recitationSubmissions.id, id) });
  if (!rec) throw notFound();
  return rec;
}

// ───────────── Reads ─────────────

export type RecitationListItem = Recitation & {
  surahName: string;
  surahNameAr: string;
  audioUrl: string | null;
  ai: typeof schema.recitationAiFeedback.$inferSelect | null;
};

async function decorate(rows: Recitation[]): Promise<RecitationListItem[]> {
  if (!rows.length) return [];
  const db = getDb();
  const [surahs, ai] = await Promise.all([
    db.select().from(schema.quranSurahs),
    db.select().from(schema.recitationAiFeedback).where(inArray(schema.recitationAiFeedback.recitationId, rows.map((r) => r.id))),
  ]);
  const surahBy = new Map(surahs.map((s) => [s.number, s]));
  const aiBy = new Map(ai.map((a) => [a.recitationId, a]));
  return Promise.all(
    rows.map(async (r) => ({
      ...r,
      surahName: surahBy.get(r.surah)?.nameTranslit ?? String(r.surah),
      surahNameAr: surahBy.get(r.surah)?.nameAr ?? "",
      audioUrl: await storage().signedUrl("recitations", r.audioPath, 1800).catch(() => null),
      ai: aiBy.get(r.id) ?? null,
    })),
  );
}

export async function listRecitations(actor: SessionUser, studentId: string, limit = 50): Promise<RecitationListItem[]> {
  if (!(await canAccessStudent(actor, studentId))) throw forbidden();
  const rows = await getDb()
    .select()
    .from(schema.recitationSubmissions)
    .where(eq(schema.recitationSubmissions.studentId, studentId))
    .orderBy(desc(schema.recitationSubmissions.createdAt))
    .limit(limit);
  return decorate(rows);
}

async function reviewableStudentIds(actor: Actor): Promise<string[] | "all"> {
  if (actor.role === "admin") return "all";
  if (actor.role !== "tutor") throw forbidden();
  return tutorStudentIds(actor.id);
}

export type QueueItem = RecitationListItem & { studentName: string };

/** Pending recitations of the tutor's students, oldest first. */
export async function listReviewQueue(actor: Actor, limit = 100): Promise<QueueItem[]> {
  const ids = await reviewableStudentIds(actor);
  if (ids !== "all" && !ids.length) return [];
  const rows = await getDb()
    .select()
    .from(schema.recitationSubmissions)
    .where(
      ids === "all"
        ? eq(schema.recitationSubmissions.status, "pending")
        : and(eq(schema.recitationSubmissions.status, "pending"), inArray(schema.recitationSubmissions.studentId, ids)),
    )
    .orderBy(asc(schema.recitationSubmissions.createdAt))
    .limit(limit);
  const [items, names] = await Promise.all([decorate(rows), displayNames([...new Set(rows.map((r) => r.studentId))])]);
  return items.map((i) => ({ ...i, studentName: names.get(i.studentId) ?? i.studentId }));
}

export async function countPendingReviews(actor: Actor): Promise<number> {
  if (actor.role !== "tutor") return 0;
  const ids = await tutorStudentIds(actor.id);
  if (!ids.length) return 0;
  const rows = await getDb()
    .select({ id: schema.recitationSubmissions.id })
    .from(schema.recitationSubmissions)
    .where(and(eq(schema.recitationSubmissions.status, "pending"), inArray(schema.recitationSubmissions.studentId, ids)));
  return rows.length;
}

/** Expected ayah texts for a range (verbatim Uthmani plus the simple text for the diff). */
export async function expectedAyahs(surah: number, from: number, to: number) {
  return getDb()
    .select({ ayah: schema.quranAyahs.ayah, textUthmani: schema.quranAyahs.textUthmani, textSimple: schema.quranAyahs.textSimple })
    .from(schema.quranAyahs)
    .where(and(eq(schema.quranAyahs.surah, surah), gte(schema.quranAyahs.ayah, from), lte(schema.quranAyahs.ayah, to)))
    .orderBy(asc(schema.quranAyahs.ayah));
}

// ───────────── Review ─────────────

export type ReviewInput = {
  score: number;
  feedback: string | null;
  status: "reviewed" | "needs_redo";
  hifzStatus?: HifzStatus | null;
};

export async function reviewRecitation(actor: SessionUser, recitationId: string, input: ReviewInput) {
  if (actor.role !== "tutor" && actor.role !== "admin") throw forbidden();
  const rec = await loadRecitation(recitationId);
  if (actor.role === "tutor" && !(await isTutorOf(actor.id, rec.studentId))) throw forbidden();

  await getDb()
    .update(schema.recitationSubmissions)
    .set({
      status: input.status,
      tutorId: actor.id,
      tutorScore: input.score,
      tutorFeedback: input.feedback,
      reviewedAt: new Date(),
    })
    .where(eq(schema.recitationSubmissions.id, recitationId));

  if (rec.hifzEntryId && input.hifzStatus) {
    await updateEntry(actor, rec.hifzEntryId, { status: input.hifzStatus, grade: input.score });
  }
  if (input.status === "reviewed" && input.score >= APPROVAL_MIN_SCORE) {
    await awardXp(rec.studentId, "recitation_approved", RECITATION_APPROVED_XP, `recitation_approved:${recitationId}`, {
      recitationId,
      score: input.score,
    });
  }

  const surah = await getDb().query.quranSurahs.findFirst({ where: eq(schema.quranSurahs.number, rec.surah), columns: { nameTranslit: true } });
  const surahName = surah?.nameTranslit ?? String(rec.surah);
  await notify(rec.studentId, "recitationReviewed", { surah: surahName }, "/student/recitations");
  const parents = await parentIdsOf(rec.studentId);
  if (parents.length) await notify(parents, "recitationReviewed", { surah: surahName }, "/parent/progress");
  return { id: recitationId };
}

/** Expected text for a range as one string pair (Uthmani verbatim, simple for the diff). */
export async function expectedText(surah: number, from: number, to: number) {
  const rows = await expectedAyahs(surah, from, to);
  return { uthmani: rows.map((r) => r.textUthmani).join(" "), simple: rows.map((r) => r.textSimple).join(" "), count: rows.length };
}

export type RecitationFormData = {
  surahs: Awaited<ReturnType<typeof listSurahs>>;
  entries: { id: string; label: string; surah: number; from: number; to: number }[];
  homework: { id: string; label: string; surah: number; from: number; to: number }[];
  aiAvailable: boolean;
  recordingAllowed: boolean;
};

/** Everything the recording form needs for a student (self or a parent's child). */
export async function recitationFormData(actor: SessionUser, studentId: string): Promise<RecitationFormData> {
  if (!(await canAccessStudent(actor, studentId))) throw forbidden();
  const db = getDb();
  const [surahs, entries, hw, recordingAllowed, aiConsent, aiFlag] = await Promise.all([
    listSurahs(),
    db
      .select()
      .from(schema.hifzEntries)
      .where(and(eq(schema.hifzEntries.studentId, studentId), inArray(schema.hifzEntries.status, ["learning", "needs_review"])))
      .orderBy(desc(schema.hifzEntries.updatedAt))
      .limit(50),
    studentHomework(actor, studentId),
    childAllows(studentId, "allowRecitationRecording"),
    childAllows(studentId, "allowAiFeedback"),
    isEnabled("ai_recitation_feedback", actor),
  ]);
  const name = new Map(surahs.map((s) => [s.number, s.nameTranslit]));
  return {
    surahs,
    entries: entries.map((e) => ({
      id: e.id,
      label: `${name.get(e.surah) ?? e.surah} ${e.ayahFrom}-${e.ayahTo}`,
      surah: e.surah,
      from: e.ayahFrom,
      to: e.ayahTo,
    })),
    homework: hw
      .filter((h) => h.homework.targetType === "recitation" && !h.submission && h.homework.surah && h.homework.ayahFrom && h.homework.ayahTo)
      .map((h) => ({
        id: h.homework.id,
        label: h.homework.title,
        surah: h.homework.surah!,
        from: h.homework.ayahFrom!,
        to: h.homework.ayahTo!,
      })),
    aiAvailable: aiFlag && isConfigured("gemini") && aiConsent,
    recordingAllowed,
  };
}
