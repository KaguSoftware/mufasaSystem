/**
 * data_export: builds a JSON export of everything we hold about one account
 * (privacy flow). Secrets (password hashes, sessions, tokens) are never included,
 * and recitation audio is referenced by metadata only.
 */
import { z } from "zod";
import { eq, or, schema } from "@mufasa/db";
import { BUCKET, PermanentJobError, type WorkerContext } from "../context";
import { register, type Job } from "./index";

const payloadSchema = z.object({ requestId: z.string().uuid() });

async function dataExport(job: Job, ctx: WorkerContext) {
  const { requestId } = payloadSchema.parse(job.payload);
  if (!ctx.supabase) throw new PermanentJobError("Supabase storage is not configured on the worker");
  const db = ctx.db;

  const [request] = await db.select().from(schema.dataRequests).where(eq(schema.dataRequests.id, requestId));
  if (!request) throw new PermanentJobError(`data request ${requestId} not found`);
  if (request.type !== "export") throw new PermanentJobError(`data request ${requestId} is not an export`);
  const uid = request.subjectUserId;

  const [u] = await db.select().from(schema.user).where(eq(schema.user.id, uid));
  if (!u) throw new PermanentJobError(`user ${uid} not found`);
  // explicit allow-list: never spread the row, so new sensitive columns cannot leak
  const account = {
    id: u.id,
    name: u.name,
    email: u.isManagedChild ? null : u.email,
    username: u.username,
    role: u.role,
    locale: u.locale,
    timezone: u.timezone,
    isManagedChild: u.isManagedChild,
    emailVerified: u.emailVerified,
    createdAt: u.createdAt,
  };

  const steps: [string, () => Promise<unknown>][] = [
    ["profile", () => db.select().from(schema.profiles).where(eq(schema.profiles.userId, uid))],
    [
      "parentLinks",
      () =>
        db
          .select()
          .from(schema.parentChildren)
          .where(or(eq(schema.parentChildren.parentId, uid), eq(schema.parentChildren.childId, uid))),
    ],
    [
      "consents",
      () =>
        db
          .select()
          .from(schema.parentalConsents)
          .where(or(eq(schema.parentalConsents.childId, uid), eq(schema.parentalConsents.parentId, uid))),
    ],
    ["enrollments", () => db.select().from(schema.enrollments).where(eq(schema.enrollments.userId, uid))],
    ["lessonProgress", () => db.select().from(schema.lessonProgress).where(eq(schema.lessonProgress.userId, uid))],
    ["quizAttempts", () => db.select().from(schema.quizAttempts).where(eq(schema.quizAttempts.userId, uid))],
    ["xpEvents", () => db.select().from(schema.xpEvents).where(eq(schema.xpEvents.userId, uid))],
    ["streak", () => db.select().from(schema.streaks).where(eq(schema.streaks.userId, uid))],
    ["badges", () => db.select().from(schema.userBadges).where(eq(schema.userBadges.userId, uid))],
    ["certificates", () => db.select().from(schema.certificates).where(eq(schema.certificates.userId, uid))],
    ["hifzEntries", () => db.select().from(schema.hifzEntries).where(eq(schema.hifzEntries.studentId, uid))],
    [
      // metadata only: the audio files stay in the private bucket
      "recitations",
      async () => {
        const rows = await db.select().from(schema.recitationSubmissions).where(eq(schema.recitationSubmissions.studentId, uid));
        return rows.map(({ audioPath, ...rest }) => ({ ...rest, hasAudio: Boolean(audioPath) }));
      },
    ],
    [
      "homeworkSubmissions",
      () => db.select().from(schema.homeworkSubmissions).where(eq(schema.homeworkSubmissions.studentId, uid)),
    ],
    ["attendance", () => db.select().from(schema.sessionAttendees).where(eq(schema.sessionAttendees.studentId, uid))],
    ["messagesSent", () => db.select().from(schema.messages).where(eq(schema.messages.senderId, uid))],
    ["notifications", () => db.select().from(schema.notifications).where(eq(schema.notifications.userId, uid))],
  ];

  const data: Record<string, unknown> = {};
  for (let i = 0; i < steps.length; i++) {
    const [key, run] = steps[i]!;
    data[key] = await run();
    await ctx.progress(((i + 1) / steps.length) * 90);
  }

  const body = JSON.stringify({ exportedAt: new Date().toISOString(), requestId, account, data }, null, 2);
  const objectPath = `exports/${uid}/${requestId}.json`;
  const { error } = await ctx.supabase.storage
    .from(BUCKET.exports)
    .upload(objectPath, new TextEncoder().encode(body), { contentType: "application/json", upsert: true });
  if (error) throw new Error(`upload ${objectPath} failed: ${error.message}`);

  await db
    .update(schema.dataRequests)
    .set({ resultPath: objectPath, status: "completed" })
    .where(eq(schema.dataRequests.id, requestId));
  return { resultPath: objectPath, bytes: body.length };
}

register("data_export", dataExport);
