import "server-only";
import { and, eq, getDb, inArray, isNull, lt, lte, gt, schema, sql } from "@mufasa/db";
import type { WebhookEvent } from "livekit-server-sdk";
import { AUTO_END_AFTER_MIN, LATE_GRACE_MIN } from "@/lib/live-window";
import { statusForJoin } from "@/lib/attendance";
import { sendClassReminderEmail } from "../services/live-emails";
import { firstName, formatWhen, guardiansOf, awardAttendanceXp, displayNames } from "./live";
import { notify } from "../notify";

const MIN = 60_000;
/** Reminders go out when a class starts within this many minutes (cron runs every 15). */
const REMINDER_LEAD_MIN = 75;

export type LiveCronResult = { reminded: number; autoEnded: number };

/**
 * Cron body (every 15 minutes):
 * 1. reminders for sessions starting soon (claimed atomically via reminderSentAt, so reruns never duplicate)
 * 2. auto-end sessions 30 minutes past their scheduled end; mark their bookings completed
 */
export async function runLiveCron(now = new Date()): Promise<LiveCronResult> {
  const db = getDb();

  // 1. reminders
  const due = await db
    .select({ id: schema.classSessions.id })
    .from(schema.classSessions)
    .where(
      and(
        eq(schema.classSessions.status, "scheduled"),
        isNull(schema.classSessions.reminderSentAt),
        gt(schema.classSessions.startsAt, now),
        lte(schema.classSessions.startsAt, new Date(now.getTime() + REMINDER_LEAD_MIN * MIN)),
      ),
    );
  let reminded = 0;
  for (const d of due) {
    const [claimed] = await db
      .update(schema.classSessions)
      .set({ reminderSentAt: now })
      .where(and(eq(schema.classSessions.id, d.id), isNull(schema.classSessions.reminderSentAt)))
      .returning();
    if (!claimed) continue;
    try {
      await sendReminders(claimed);
      reminded++;
    } catch (err) {
      console.error("[live-cron] reminder failed", d.id, err);
      // Release the claim so the next run retries.
      await db.update(schema.classSessions).set({ reminderSentAt: null }).where(eq(schema.classSessions.id, d.id));
    }
  }

  // 2. auto-end
  const cutoff = new Date(now.getTime() - AUTO_END_AFTER_MIN * MIN);
  const ended = await db
    .update(schema.classSessions)
    .set({ status: "ended", endedAt: now })
    .where(
      and(
        inArray(schema.classSessions.status, ["scheduled", "live"]),
        lt(sql`${schema.classSessions.startsAt} + (${schema.classSessions.durationMin} * interval '1 minute')`, cutoff),
      ),
    )
    .returning({ id: schema.classSessions.id });
  if (ended.length) {
    await db
      .update(schema.bookings)
      .set({ status: "completed" })
      .where(
        and(
          inArray(schema.bookings.sessionId, ended.map((e) => e.id)),
          eq(schema.bookings.status, "confirmed"),
        ),
      );
  }
  return { reminded, autoEnded: ended.length };
}

async function sendReminders(s: typeof schema.classSessions.$inferSelect) {
  const db = getDb();
  const att = await db
    .select({ studentId: schema.sessionAttendees.studentId })
    .from(schema.sessionAttendees)
    .where(eq(schema.sessionAttendees.sessionId, s.id));
  const students = att.map((a) => a.studentId);
  if (!students.length) return;
  const guardians = await guardiansOf(students);
  const parents = [...new Set([...guardians.values()].flat())];
  const recipients = await db
    .select({
      id: schema.user.id,
      email: schema.user.email,
      role: schema.user.role,
      locale: schema.user.locale,
      timezone: schema.user.timezone,
      name: schema.user.name,
      managed: schema.user.isManagedChild,
    })
    .from(schema.user)
    .where(inArray(schema.user.id, [...students, ...parents]));
  const names = await displayNames(recipients.map((r) => r.id));
  for (const r of recipients) {
    const when = formatWhen(s.startsAt, r.timezone, r.locale);
    const href = r.role === "student" ? "/student/classes" : "/parent/bookings";
    await notify(r.id, "classReminder", { title: s.title, time: when }, href);
    // Managed children have no inbox: their parents are emailed instead.
    if (!r.managed) {
      await sendClassReminderEmail({
        to: r.email,
        name: firstName(names.get(r.id) ?? r.name),
        locale: r.locale,
        title: s.title,
        when,
        role: r.role,
      }).catch((err) => console.error("[live-cron] email failed", r.id, err));
    }
  }
}

/**
 * Applies a verified LiveKit webhook event. Idempotent: every write is conditional on the
 * stored state, so redelivered events change nothing.
 */
export async function handleLivekitEvent(event: WebhookEvent): Promise<{ handled: boolean }> {
  const db = getDb();
  const roomName = event.room?.name;
  if (!roomName) return { handled: false };
  const s = await db.query.classSessions.findFirst({ where: eq(schema.classSessions.roomName, roomName) });
  if (!s) return { handled: false };
  const at = event.createdAt ? new Date(Number(event.createdAt) * 1000) : new Date();

  if (event.event === "room_finished") {
    // Close any open presence segments, then end the session.
    await db
      .update(schema.sessionAttendees)
      .set({
        leftAt: at,
        secondsPresent: sql`${schema.sessionAttendees.secondsPresent} + greatest(0, extract(epoch from (${at.toISOString()}::timestamptz - ${schema.sessionAttendees.joinedAt}))::int)`,
      })
      .where(
        and(
          eq(schema.sessionAttendees.sessionId, s.id),
          sql`${schema.sessionAttendees.joinedAt} is not null`,
          sql`(${schema.sessionAttendees.leftAt} is null or ${schema.sessionAttendees.leftAt} < ${schema.sessionAttendees.joinedAt})`,
          sql`${schema.sessionAttendees.joinedAt} <= ${at.toISOString()}::timestamptz`,
        ),
      );
    if (s.status !== "ended" && s.status !== "cancelled") {
      await db
        .update(schema.classSessions)
        .set({ status: "ended", endedAt: s.endedAt ?? at })
        .where(eq(schema.classSessions.id, s.id));
      await db
        .update(schema.bookings)
        .set({ status: "completed" })
        .where(and(eq(schema.bookings.sessionId, s.id), eq(schema.bookings.status, "confirmed")));
    }
    return { handled: true };
  }

  const identity = event.participant?.identity;
  if (!identity) return { handled: false };

  if (event.event === "participant_joined") {
    if (identity === s.tutorId) {
      if (!s.tutorJoinedAt || s.status === "scheduled") {
        await db
          .update(schema.classSessions)
          .set({ tutorJoinedAt: s.tutorJoinedAt ?? at, status: s.status === "scheduled" ? "live" : s.status })
          .where(eq(schema.classSessions.id, s.id));
      }
      return { handled: true };
    }
    const a = await db.query.sessionAttendees.findFirst({
      where: and(eq(schema.sessionAttendees.sessionId, s.id), eq(schema.sessionAttendees.studentId, identity)),
    });
    if (!a) return { handled: false };
    // Duplicate or older event for a segment we already know about.
    if (a.joinedAt && !a.leftAt) return { handled: true };
    if (a.joinedAt && a.leftAt && at.getTime() <= a.leftAt.getTime()) return { handled: true };

    const markPresent = a.status === "expected" || a.status === "absent";
    await db
      .update(schema.sessionAttendees)
      .set({
        joinedAt: at,
        leftAt: null,
        ...(markPresent ? { status: statusForJoin(s.startsAt, at, LATE_GRACE_MIN), markedBy: "livekit" as const } : {}),
      })
      .where(and(eq(schema.sessionAttendees.sessionId, s.id), eq(schema.sessionAttendees.studentId, identity)));
    if (markPresent) await awardAttendanceXp(identity, s.id);
    return { handled: true };
  }

  if (event.event === "participant_left") {
    if (identity === s.tutorId) return { handled: true };
    await db
      .update(schema.sessionAttendees)
      .set({
        leftAt: at,
        secondsPresent: sql`${schema.sessionAttendees.secondsPresent} + greatest(0, extract(epoch from (${at.toISOString()}::timestamptz - ${schema.sessionAttendees.joinedAt}))::int)`,
      })
      .where(
        and(
          eq(schema.sessionAttendees.sessionId, s.id),
          eq(schema.sessionAttendees.studentId, identity),
          sql`${schema.sessionAttendees.joinedAt} is not null`,
          sql`(${schema.sessionAttendees.leftAt} is null or ${schema.sessionAttendees.leftAt} < ${schema.sessionAttendees.joinedAt})`,
          sql`${schema.sessionAttendees.joinedAt} <= ${at.toISOString()}::timestamptz`,
        ),
      );
    return { handled: true };
  }
  return { handled: false };
}
