import "server-only";
import { z } from "zod";
import { and, asc, desc, eq, getDb, gte, inArray, lt, lte, ne, schema, sql } from "@mufasa/db";
import type { I18nText } from "@mufasa/config/locales";
import { isConfigured } from "@/env";
import { attendanceStats, type AttendanceStats } from "@/lib/attendance";
import {
  isHttpsUrl,
  localDateTimeToUtc,
  recurringStarts,
  sessionEnd,
  tokenTtlSeconds,
  windowState,
  type WindowState,
} from "@/lib/live-window";
import { AppError, conflict, forbidden, notFound } from "../errors";
import { isEnabled } from "../flags";
import { audit } from "../audit";
import { notify, type NotificationType } from "../notify";
import { canAccessStudent, isParentOf, type SessionUser } from "../session";
import { awardXp } from "../services/gamification";
import { mintToken, muteAllAudio, removeParticipant } from "../services/livekit";
import { childAllows } from "./family";

export const CLASS_ATTENDED_XP = 15;

// ───────────── shared helpers (also used by live-bookings / live-cron) ─────────────

/** Children show a first name only (child safety). */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export async function displayNames(userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return new Map();
  const rows = await getDb()
    .select({ id: schema.user.id, name: schema.user.name, displayName: schema.profiles.displayName })
    .from(schema.user)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.user.id))
    .where(inArray(schema.user.id, ids));
  return new Map(rows.map((r) => [r.id, r.displayName ?? r.name]));
}

/** Parent ids for a set of children. */
export async function guardiansOf(childIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!childIds.length) return out;
  const rows = await getDb()
    .select({ parentId: schema.parentChildren.parentId, childId: schema.parentChildren.childId })
    .from(schema.parentChildren)
    .where(inArray(schema.parentChildren.childId, childIds));
  for (const r of rows) out.set(r.childId, [...(out.get(r.childId) ?? []), r.parentId]);
  return out;
}

/** "Mon 12 Oct, 17:00" in the recipient's timezone and locale. */
export function formatWhen(instant: Date, timeZone: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(instant);
  } catch {
    return instant.toISOString();
  }
}

/** Notify users with a time rendered in each recipient's own timezone/locale. */
export async function notifyWithTime(
  userIds: string[],
  type: NotificationType,
  instant: Date,
  params: Record<string, string | number>,
  href?: string,
) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  const users = await getDb()
    .select({ id: schema.user.id, timezone: schema.user.timezone, locale: schema.user.locale })
    .from(schema.user)
    .where(inArray(schema.user.id, ids));
  for (const u of users) {
    await notify(u.id, type, { ...params, time: formatWhen(instant, u.timezone, u.locale) }, href);
  }
}

function requireStaff(actor: SessionUser) {
  if (actor.role !== "admin" && actor.role !== "tutor") throw forbidden();
}

/** Can livekit classrooms be used right now? (flag + env). */
export async function liveModeAvailable(actor: Pick<SessionUser, "id" | "role">): Promise<boolean> {
  return isConfigured("livekit") && (await isEnabled("live_video", actor));
}

// ───────────── class groups ─────────────

export const groupInputSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    tutorId: z.string().min(1),
    programId: z.string().uuid().nullable().optional(),
    courseId: z.string().uuid().nullable().optional(),
    capacity: z.number().int().min(1).max(50),
    ageMin: z.number().int().min(3).max(99).nullable().optional(),
    ageMax: z.number().int().min(3).max(99).nullable().optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => v.ageMin == null || v.ageMax == null || v.ageMin <= v.ageMax, {
    path: ["ageMax"],
    message: "age_range",
  });
export type GroupInput = z.infer<typeof groupInputSchema>;

export type GroupRow = {
  id: string;
  name: string;
  tutorId: string;
  tutorName: string;
  programId: string | null;
  courseId: string | null;
  capacity: number;
  ageMin: number | null;
  ageMax: number | null;
  active: boolean;
  members: { id: string; name: string }[];
};

/** Admin sees every group; a tutor sees only their own (read only: admins manage enrollment). */
export async function listGroups(actor: SessionUser): Promise<GroupRow[]> {
  requireStaff(actor);
  const db = getDb();
  const groups = await db
    .select()
    .from(schema.classGroups)
    .where(actor.role === "admin" ? undefined : eq(schema.classGroups.tutorId, actor.id))
    .orderBy(desc(schema.classGroups.active), asc(schema.classGroups.name));
  if (!groups.length) return [];
  const members = await db
    .select({ groupId: schema.classGroupMembers.groupId, studentId: schema.classGroupMembers.studentId })
    .from(schema.classGroupMembers)
    .where(inArray(schema.classGroupMembers.groupId, groups.map((g) => g.id)));
  const names = await displayNames([...groups.map((g) => g.tutorId), ...members.map((m) => m.studentId)]);
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    tutorId: g.tutorId,
    tutorName: names.get(g.tutorId) ?? "",
    programId: g.programId,
    courseId: g.courseId,
    capacity: g.capacity,
    ageMin: g.ageMin,
    ageMax: g.ageMax,
    active: g.active,
    members: members
      .filter((m) => m.groupId === g.id)
      .map((m) => ({ id: m.studentId, name: names.get(m.studentId) ?? "" }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

export type GroupOptions = {
  tutors: { id: string; name: string }[];
  students: { id: string; name: string }[];
  programs: { id: string; name: I18nText }[];
  courses: { id: string; programId: string; title: I18nText }[];
};

/** Option lists for the admin group dialogs. */
export async function groupFormOptions(actor: SessionUser) {
  if (actor.role !== "admin") throw forbidden();
  const db = getDb();
  const [tutors, students, programs, courses] = await Promise.all([
    db
      .select({ id: schema.user.id, name: schema.user.name, displayName: schema.profiles.displayName })
      .from(schema.user)
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.user.id))
      .where(eq(schema.user.role, "tutor"))
      .orderBy(asc(schema.user.name)),
    db
      .select({ id: schema.user.id, name: schema.user.name, displayName: schema.profiles.displayName })
      .from(schema.user)
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.user.id))
      .where(eq(schema.user.role, "student"))
      .orderBy(asc(schema.user.name))
      .limit(1000),
    db.select({ id: schema.programs.id, name: schema.programs.name }).from(schema.programs).orderBy(asc(schema.programs.sortOrder)),
    db
      .select({ id: schema.courses.id, programId: schema.courses.programId, title: schema.courses.title })
      .from(schema.courses)
      .orderBy(asc(schema.courses.sortOrder)),
  ]);
  return {
    tutors: tutors.map((t) => ({ id: t.id, name: t.displayName ?? t.name })),
    students: students.map((s) => ({ id: s.id, name: s.displayName ?? s.name })),
    programs,
    courses,
  };
}

async function assertTutorUser(tutorId: string) {
  const u = await getDb().query.user.findFirst({ where: eq(schema.user.id, tutorId), columns: { role: true } });
  if (!u || u.role !== "tutor") throw new AppError("validation", "tutor", { tutorId: ["invalid_tutor"] });
}

export async function createGroup(actor: SessionUser, input: GroupInput): Promise<{ id: string }> {
  if (actor.role !== "admin") throw forbidden();
  const data = groupInputSchema.parse(input);
  await assertTutorUser(data.tutorId);
  const [row] = await getDb()
    .insert(schema.classGroups)
    .values({
      name: data.name,
      tutorId: data.tutorId,
      programId: data.programId ?? null,
      courseId: data.courseId ?? null,
      capacity: data.capacity,
      ageMin: data.ageMin ?? null,
      ageMax: data.ageMax ?? null,
      active: data.active ?? true,
    })
    .returning({ id: schema.classGroups.id });
  await audit({ actorId: actor.id, action: "group.create", entity: "class_groups", entityId: row!.id, after: data });
  return { id: row!.id };
}

export async function updateGroup(actor: SessionUser, groupId: string, input: GroupInput): Promise<void> {
  if (actor.role !== "admin") throw forbidden();
  const data = groupInputSchema.parse(input);
  const db = getDb();
  const before = await db.query.classGroups.findFirst({ where: eq(schema.classGroups.id, groupId) });
  if (!before) throw notFound();
  await assertTutorUser(data.tutorId);
  const members = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.classGroupMembers)
    .where(eq(schema.classGroupMembers.groupId, groupId));
  if ((members[0]?.n ?? 0) > data.capacity) throw new AppError("validation", "capacity", { capacity: ["below_members"] });
  await db.transaction(async (tx) => {
    await tx
      .update(schema.classGroups)
      .set({
        name: data.name,
        tutorId: data.tutorId,
        programId: data.programId ?? null,
        courseId: data.courseId ?? null,
        capacity: data.capacity,
        ageMin: data.ageMin ?? null,
        ageMax: data.ageMax ?? null,
        active: data.active ?? before.active,
      })
      .where(eq(schema.classGroups.id, groupId));
    if (before.tutorId !== data.tutorId) {
      // Future sessions follow the new tutor.
      await tx
        .update(schema.classSessions)
        .set({ tutorId: data.tutorId })
        .where(
          and(
            eq(schema.classSessions.groupId, groupId),
            eq(schema.classSessions.status, "scheduled"),
            gte(schema.classSessions.startsAt, new Date()),
          ),
        );
    }
  });
  await audit({ actorId: actor.id, action: "group.update", entity: "class_groups", entityId: groupId, before, after: data });
}

export async function addGroupMember(actor: SessionUser, groupId: string, studentId: string): Promise<void> {
  if (actor.role !== "admin") throw forbidden();
  const db = getDb();
  const group = await db.query.classGroups.findFirst({ where: eq(schema.classGroups.id, groupId) });
  if (!group) throw notFound();
  const student = await db.query.user.findFirst({ where: eq(schema.user.id, studentId), columns: { role: true } });
  if (!student || student.role !== "student") throw new AppError("validation", "student", { studentId: ["not_student"] });

  const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.userId, studentId), columns: { birthYear: true } });
  if (profile?.birthYear && (group.ageMin != null || group.ageMax != null)) {
    const age = new Date().getFullYear() - profile.birthYear;
    if ((group.ageMin != null && age < group.ageMin) || (group.ageMax != null && age > group.ageMax)) {
      throw new AppError("validation", "age", { studentId: ["age_out_of_range"] });
    }
  }

  await db.transaction(async (tx) => {
    // Lock the group row so two concurrent adds cannot exceed capacity.
    await tx.execute(sql`select id from class_groups where id = ${groupId} for update`);
    const [cnt] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.classGroupMembers)
      .where(eq(schema.classGroupMembers.groupId, groupId));
    const already = await tx.query.classGroupMembers.findFirst({
      where: and(eq(schema.classGroupMembers.groupId, groupId), eq(schema.classGroupMembers.studentId, studentId)),
    });
    if (already) throw conflict("already_member");
    if ((cnt?.n ?? 0) >= group.capacity) throw conflict("group_full");
    await tx.insert(schema.classGroupMembers).values({ groupId, studentId });
    const future = await tx
      .select({ id: schema.classSessions.id })
      .from(schema.classSessions)
      .where(
        and(
          eq(schema.classSessions.groupId, groupId),
          eq(schema.classSessions.status, "scheduled"),
          gte(schema.classSessions.startsAt, new Date()),
        ),
      );
    if (future.length) {
      await tx
        .insert(schema.sessionAttendees)
        .values(future.map((s) => ({ sessionId: s.id, studentId })))
        .onConflictDoNothing();
    }
  });
  await audit({ actorId: actor.id, action: "group.member_add", entity: "class_groups", entityId: groupId, after: { studentId } });
}

export async function removeGroupMember(actor: SessionUser, groupId: string, studentId: string): Promise<void> {
  if (actor.role !== "admin") throw forbidden();
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.classGroupMembers)
      .where(and(eq(schema.classGroupMembers.groupId, groupId), eq(schema.classGroupMembers.studentId, studentId)));
    const future = await tx
      .select({ id: schema.classSessions.id })
      .from(schema.classSessions)
      .where(
        and(
          eq(schema.classSessions.groupId, groupId),
          eq(schema.classSessions.status, "scheduled"),
          gte(schema.classSessions.startsAt, new Date()),
        ),
      );
    if (future.length) {
      await tx
        .delete(schema.sessionAttendees)
        .where(
          and(
            inArray(schema.sessionAttendees.sessionId, future.map((s) => s.id)),
            eq(schema.sessionAttendees.studentId, studentId),
            eq(schema.sessionAttendees.status, "expected"),
          ),
        );
    }
  });
  await audit({ actorId: actor.id, action: "group.member_remove", entity: "class_groups", entityId: groupId, before: { studentId } });
}

// ───────────── sessions ─────────────

export const scheduleSchema = z
  .object({
    groupId: z.string().uuid(),
    title: z.string().trim().min(2).max(120),
    /** Wall time in the actor's timezone: "yyyy-MM-ddTHH:mm" (DatePicker withTime). */
    startsAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    durationMin: z.number().int().min(15).max(180),
    mode: z.enum(["livekit", "external_link"]),
    meetingUrl: z.string().trim().max(500).nullable().optional(),
    /** Total number of weekly occurrences, including the first. 1 = no recurrence. */
    weeks: z.number().int().min(1).max(26).default(1),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "external_link" && !(v.meetingUrl && isHttpsUrl(v.meetingUrl))) {
      ctx.addIssue({ code: "custom", path: ["meetingUrl"], message: "https_required" });
    }
  });
export type ScheduleInput = z.input<typeof scheduleSchema>;

async function resolveMode(actor: SessionUser, mode: "livekit" | "external_link") {
  if (mode === "livekit" && !(await liveModeAvailable(actor))) {
    throw new AppError("validation", "livekit_unavailable", { mode: ["livekit_unavailable"] });
  }
}

async function assertNoOverlap(tutorId: string, starts: { startsAt: Date; durationMin: number }[], ignoreId?: string) {
  const db = getDb();
  for (const s of starts) {
    const end = sessionEnd(s.startsAt, s.durationMin);
    const clash = await db
      .select({ id: schema.classSessions.id })
      .from(schema.classSessions)
      .where(
        and(
          eq(schema.classSessions.tutorId, tutorId),
          ne(schema.classSessions.status, "cancelled"),
          lt(schema.classSessions.startsAt, end),
          sql`${schema.classSessions.startsAt} + (${schema.classSessions.durationMin} * interval '1 minute') > ${s.startsAt}`,
          ignoreId ? ne(schema.classSessions.id, ignoreId) : undefined,
        ),
      )
      .limit(1);
    if (clash.length) throw conflict("tutor_busy");
  }
}

/**
 * Creates one session, or N weekly sessions, for a group. A tutor can schedule for their own
 * groups; an admin for any group (the group's tutor teaches). Attendee rows (expected) are
 * created for every current member.
 */
export async function scheduleSessions(actor: SessionUser, input: ScheduleInput): Promise<{ ids: string[] }> {
  requireStaff(actor);
  const data = scheduleSchema.parse(input);
  const db = getDb();
  const group = await db.query.classGroups.findFirst({ where: eq(schema.classGroups.id, data.groupId) });
  if (!group) throw notFound();
  if (actor.role === "tutor" && group.tutorId !== actor.id) throw forbidden();
  if (!group.active) throw conflict("group_inactive");
  await resolveMode(actor, data.mode);

  const tz = actor.timezone;
  const starts = recurringStarts(data.startsAtLocal, tz, data.weeks);
  if (!starts.length || !localDateTimeToUtc(data.startsAtLocal, tz)) {
    throw new AppError("validation", "startsAt", { startsAtLocal: ["invalid_time"] });
  }
  if (starts[0]!.getTime() < Date.now() - 5 * 60_000) {
    throw new AppError("validation", "startsAt", { startsAtLocal: ["in_the_past"] });
  }
  await assertNoOverlap(group.tutorId, starts.map((startsAt) => ({ startsAt, durationMin: data.durationMin })));

  const members = await db
    .select({ studentId: schema.classGroupMembers.studentId })
    .from(schema.classGroupMembers)
    .where(eq(schema.classGroupMembers.groupId, group.id));

  const ids = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(schema.classSessions)
      .values(
        starts.map((startsAt) => ({
          groupId: group.id,
          tutorId: group.tutorId,
          title: data.title,
          startsAt,
          durationMin: data.durationMin,
          mode: data.mode,
          meetingUrl: data.mode === "external_link" ? data.meetingUrl! : null,
          roomName: data.mode === "livekit" ? `mufasa-${crypto.randomUUID()}` : null,
        })),
      )
      .returning({ id: schema.classSessions.id });
    if (members.length) {
      await tx
        .insert(schema.sessionAttendees)
        .values(rows.flatMap((r) => members.map((m) => ({ sessionId: r.id, studentId: m.studentId }))))
        .onConflictDoNothing();
    }
    return rows.map((r) => r.id);
  });
  if (actor.role === "admin") {
    await audit({ actorId: actor.id, action: "session.schedule", entity: "class_sessions", entityId: ids[0], after: { groupId: group.id, count: ids.length } });
  }
  return { ids };
}

export const editSessionSchema = z.object({
  sessionId: z.string().uuid(),
  title: z.string().trim().min(2).max(120),
  startsAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  durationMin: z.number().int().min(15).max(180),
  meetingUrl: z.string().trim().max(500).nullable().optional(),
});

async function loadOwnedSession(actor: SessionUser, sessionId: string) {
  const s = await getDb().query.classSessions.findFirst({ where: eq(schema.classSessions.id, sessionId) });
  if (!s) throw notFound();
  if (actor.role !== "admin" && !(actor.role === "tutor" && s.tutorId === actor.id)) throw forbidden();
  return s;
}

export async function editSession(actor: SessionUser, input: z.input<typeof editSessionSchema>): Promise<void> {
  const data = editSessionSchema.parse(input);
  const s = await loadOwnedSession(actor, data.sessionId);
  if (s.status !== "scheduled") throw conflict("session_not_editable");
  const startsAt = localDateTimeToUtc(data.startsAtLocal, actor.timezone);
  if (!startsAt) throw new AppError("validation", "startsAt", { startsAtLocal: ["invalid_time"] });
  // Empty means "keep the current link".
  const nextUrl = data.meetingUrl || s.meetingUrl;
  if (s.mode === "external_link" && !(nextUrl && isHttpsUrl(nextUrl))) {
    throw new AppError("validation", "meetingUrl", { meetingUrl: ["https_required"] });
  }
  await assertNoOverlap(s.tutorId, [{ startsAt, durationMin: data.durationMin }], s.id);
  const moved = startsAt.getTime() !== s.startsAt.getTime();
  await getDb()
    .update(schema.classSessions)
    .set({
      title: data.title,
      startsAt,
      durationMin: data.durationMin,
      meetingUrl: s.mode === "external_link" ? nextUrl : null,
      reminderSentAt: moved ? null : s.reminderSentAt,
    })
    .where(eq(schema.classSessions.id, s.id));
  if (s.groupId === null) {
    await getDb()
      .update(schema.bookings)
      .set({ startsAt, durationMin: data.durationMin })
      .where(eq(schema.bookings.sessionId, s.id));
  }
}

/** Students plus their parents (deduplicated). */
async function attendeeAudience(sessionId: string) {
  const rows = await getDb()
    .select({ studentId: schema.sessionAttendees.studentId })
    .from(schema.sessionAttendees)
    .where(eq(schema.sessionAttendees.sessionId, sessionId));
  const students = rows.map((r) => r.studentId);
  const guardians = await guardiansOf(students);
  return { students, parents: [...new Set([...guardians.values()].flat())] };
}

export async function cancelSession(actor: SessionUser, sessionId: string): Promise<void> {
  const s = await loadOwnedSession(actor, sessionId);
  if (s.status === "cancelled") return;
  if (s.status === "ended") throw conflict("session_not_editable");
  await getDb().transaction(async (tx) => {
    await tx.update(schema.classSessions).set({ status: "cancelled" }).where(eq(schema.classSessions.id, s.id));
    await tx
      .update(schema.bookings)
      .set({ status: "cancelled" })
      .where(and(eq(schema.bookings.sessionId, s.id), inArray(schema.bookings.status, ["pending", "confirmed"])));
  });
  const { students, parents } = await attendeeAudience(s.id);
  await notifyWithTime([...students, ...parents], "classCancelled", s.startsAt, { title: s.title }, undefined);
  if (actor.role === "admin") {
    await audit({ actorId: actor.id, action: "session.cancel", entity: "class_sessions", entityId: s.id });
  }
}

// ───────────── reads ─────────────

export type SessionRow = {
  id: string;
  title: string;
  startsAt: Date;
  durationMin: number;
  mode: schema.SessionMode;
  status: "scheduled" | "live" | "ended" | "cancelled";
  groupId: string | null;
  groupName: string | null;
  tutorId: string;
  tutorName: string;
  /** Tutor listings: number of attendees. */
  attendeeCount?: number;
  /** Student listings: this student's id, name and attendance. */
  studentId?: string;
  studentName?: string;
  attendance?: "expected" | "present" | "late" | "absent" | "excused";
};

const sessionCols = {
  id: schema.classSessions.id,
  title: schema.classSessions.title,
  startsAt: schema.classSessions.startsAt,
  durationMin: schema.classSessions.durationMin,
  mode: schema.classSessions.mode,
  status: schema.classSessions.status,
  groupId: schema.classSessions.groupId,
  groupName: schema.classGroups.name,
  tutorId: schema.classSessions.tutorId,
};

/** Student ids a viewer may query: self, own children, or any (admin / assigned tutor via canAccessStudent). */
async function allowedStudentIds(actor: SessionUser, studentId?: string): Promise<string[]> {
  if (studentId) {
    if (!(await canAccessStudent(actor, studentId))) throw forbidden();
    return [studentId];
  }
  if (actor.role === "student") return [actor.id];
  if (actor.role === "parent") {
    const rows = await getDb()
      .select({ id: schema.parentChildren.childId })
      .from(schema.parentChildren)
      .where(eq(schema.parentChildren.parentId, actor.id));
    return rows.map((r) => r.id);
  }
  throw forbidden();
}

/**
 * Upcoming (not ended, not cancelled) sessions.
 * - { studentId }: that student (self, a parent's child, assigned tutor, admin)
 * - no argument: student -> self, parent -> all children, tutor -> own sessions
 */
export async function upcomingSessionsFor(
  actor: SessionUser,
  opts: { studentId?: string; limit?: number; includeLive?: boolean } = {},
): Promise<SessionRow[]> {
  const limit = opts.limit ?? 20;
  const db = getDb();
  // A session stays "upcoming" until its scheduled end (so a running class is still listed).
  const notOver = sql`${schema.classSessions.startsAt} + (${schema.classSessions.durationMin} * interval '1 minute') >= now()`;
  const active = and(inArray(schema.classSessions.status, ["scheduled", "live"]), notOver);

  if (!opts.studentId && actor.role === "tutor") {
    const rows = await db
      .select({
        ...sessionCols,
        attendeeCount: sql<number>`(select count(*)::int from session_attendees sa where sa.session_id = ${schema.classSessions.id})`,
      })
      .from(schema.classSessions)
      .leftJoin(schema.classGroups, eq(schema.classGroups.id, schema.classSessions.groupId))
      .where(and(eq(schema.classSessions.tutorId, actor.id), active))
      .orderBy(asc(schema.classSessions.startsAt))
      .limit(limit);
    const names = await displayNames(rows.map((r) => r.tutorId));
    return rows.map((r) => ({ ...r, tutorName: names.get(r.tutorId) ?? "" }));
  }
  const ids = await allowedStudentIds(actor, opts.studentId);
  if (!ids.length) return [];
  const rows = await db
    .select({ ...sessionCols, studentId: schema.sessionAttendees.studentId, attendance: schema.sessionAttendees.status })
    .from(schema.sessionAttendees)
    .innerJoin(schema.classSessions, eq(schema.classSessions.id, schema.sessionAttendees.sessionId))
    .leftJoin(schema.classGroups, eq(schema.classGroups.id, schema.classSessions.groupId))
    .where(and(inArray(schema.sessionAttendees.studentId, ids), active))
    .orderBy(asc(schema.classSessions.startsAt))
    .limit(limit);
  const names = await displayNames([...rows.map((r) => r.tutorId), ...rows.map((r) => r.studentId)]);
  return rows.map((r) => ({ ...r, tutorName: names.get(r.tutorId) ?? "", studentName: names.get(r.studentId) ?? "" }));
}

/** Past sessions (ended or finished by time) with the student's attendance. */
export async function pastSessionsFor(
  actor: SessionUser,
  opts: { studentId?: string; limit?: number } = {},
): Promise<SessionRow[]> {
  const ids = await allowedStudentIds(actor, opts.studentId ?? (actor.role === "student" ? actor.id : undefined));
  if (!ids.length) return [];
  const rows = await getDb()
    .select({ ...sessionCols, studentId: schema.sessionAttendees.studentId, attendance: schema.sessionAttendees.status })
    .from(schema.sessionAttendees)
    .innerJoin(schema.classSessions, eq(schema.classSessions.id, schema.sessionAttendees.sessionId))
    .leftJoin(schema.classGroups, eq(schema.classGroups.id, schema.classSessions.groupId))
    .where(
      and(
        inArray(schema.sessionAttendees.studentId, ids),
        ne(schema.classSessions.status, "cancelled"),
        sql`(${schema.classSessions.status} = 'ended' or ${schema.classSessions.startsAt} + (${schema.classSessions.durationMin} * interval '1 minute') < now())`,
      ),
    )
    .orderBy(desc(schema.classSessions.startsAt))
    .limit(opts.limit ?? 30);
  const names = await displayNames([...rows.map((r) => r.tutorId), ...rows.map((r) => r.studentId)]);
  return rows.map((r) => ({ ...r, tutorName: names.get(r.tutorId) ?? "", studentName: names.get(r.studentId) ?? "" }));
}

/** Tutor week list: sessions from `from` to `to` (any status), with attendee counts. Admins see all tutors. */
export async function tutorSessionsBetween(actor: SessionUser, from: Date, to: Date): Promise<SessionRow[]> {
  requireStaff(actor);
  const rows = await getDb()
    .select({
      ...sessionCols,
      attendeeCount: sql<number>`(select count(*)::int from session_attendees sa where sa.session_id = ${schema.classSessions.id})`,
    })
    .from(schema.classSessions)
    .leftJoin(schema.classGroups, eq(schema.classGroups.id, schema.classSessions.groupId))
    .where(
      and(
        actor.role === "admin" ? undefined : eq(schema.classSessions.tutorId, actor.id),
        gte(schema.classSessions.startsAt, from),
        lte(schema.classSessions.startsAt, to),
      ),
    )
    .orderBy(asc(schema.classSessions.startsAt));
  const names = await displayNames(rows.map((r) => r.tutorId));
  return rows.map((r) => ({ ...r, tutorName: names.get(r.tutorId) ?? "" }));
}

export type SessionDetail = {
  id: string;
  title: string;
  startsAt: Date;
  durationMin: number;
  mode: schema.SessionMode;
  status: "scheduled" | "live" | "ended" | "cancelled";
  meetingUrl: string | null;
  groupId: string | null;
  groupName: string | null;
  tutorId: string;
  tutorName: string;
  tutorJoinedAt: Date | null;
  viewer: "tutor" | "admin" | "student" | "parent";
  /** The student the viewer joins as (student: self). Null for tutors, admins and parents. */
  joinAsStudentId: string | null;
  attendees: { studentId: string; name: string; status: "expected" | "present" | "late" | "absent" | "excused"; secondsPresent: number }[];
};

/**
 * Access: the session's tutor and admins see all attendees; an attendee student sees only
 * themselves; a parent sees only their own children. meetingUrl is returned only to people
 * who may join (tutor, attendee student) and never to a parent or admin viewer.
 */
export async function sessionDetail(actor: SessionUser, sessionId: string): Promise<SessionDetail> {
  const db = getDb();
  const s = await db.query.classSessions.findFirst({ where: eq(schema.classSessions.id, sessionId) });
  if (!s) throw notFound();
  const group = s.groupId
    ? await db.query.classGroups.findFirst({ where: eq(schema.classGroups.id, s.groupId), columns: { name: true } })
    : null;
  const all = await db.select().from(schema.sessionAttendees).where(eq(schema.sessionAttendees.sessionId, s.id));

  let viewer: SessionDetail["viewer"];
  let visible = all;
  let joinAs: string | null = null;
  if (actor.role === "admin") viewer = "admin";
  else if (actor.role === "tutor" && s.tutorId === actor.id) viewer = "tutor";
  else if (actor.role === "student") {
    visible = all.filter((a) => a.studentId === actor.id);
    if (!visible.length) throw forbidden();
    viewer = "student";
    joinAs = actor.id;
  } else if (actor.role === "parent") {
    const mine: typeof all = [];
    for (const a of all) if (await isParentOf(actor.id, a.studentId)) mine.push(a);
    if (!mine.length) throw forbidden();
    visible = mine;
    viewer = "parent";
  } else throw forbidden();

  const names = await displayNames([s.tutorId, ...visible.map((a) => a.studentId)]);
  const canSeeLink = viewer === "tutor" || viewer === "student";
  return {
    id: s.id,
    title: s.title,
    startsAt: s.startsAt,
    durationMin: s.durationMin,
    mode: s.mode,
    status: s.status,
    meetingUrl: canSeeLink ? s.meetingUrl : null,
    groupId: s.groupId,
    groupName: group?.name ?? null,
    tutorId: s.tutorId,
    tutorName: names.get(s.tutorId) ?? "",
    tutorJoinedAt: s.tutorJoinedAt,
    viewer,
    joinAsStudentId: joinAs,
    attendees: visible
      .map((a) => ({
        studentId: a.studentId,
        name: names.get(a.studentId) ?? "",
        status: a.status,
        secondsPresent: a.secondsPresent,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ───────────── joining ─────────────

export type JoinResult =
  | { kind: "livekit"; token: string; url: string; role: "tutor" | "student" }
  | { kind: "external"; url: string; role: "tutor" | "student" };

/**
 * Entry point for both the token API and the room page. Child safety gates, in order:
 * 1. only the session's tutor or an attendee student may join
 * 2. a managed child needs the parent's active live-video consent
 * 3. only from 15 minutes before the start until the scheduled end
 * 4. students get no LiveKit token until the tutor has joined (tutorJoinedAt)
 */
export async function joinSession(actor: SessionUser, sessionId: string, now = new Date()): Promise<JoinResult> {
  const db = getDb();
  const s = await db.query.classSessions.findFirst({ where: eq(schema.classSessions.id, sessionId) });
  if (!s) throw notFound();
  if (s.status === "cancelled" || s.status === "ended") throw conflict("session_over");

  const isTutor = actor.role === "tutor" && s.tutorId === actor.id;
  let isStudent = false;
  if (!isTutor) {
    if (actor.role !== "student") throw forbidden();
    const row = await db.query.sessionAttendees.findFirst({
      where: and(eq(schema.sessionAttendees.sessionId, s.id), eq(schema.sessionAttendees.studentId, actor.id)),
      columns: { studentId: true },
    });
    if (!row) throw forbidden();
    isStudent = true;
    if (!(await childAllows(actor.id, "allowLiveVideo"))) throw new AppError("forbidden", "consent_live_video");
  }

  const w = windowState(s.startsAt, s.durationMin, now);
  if (w !== "open") throw conflict(w === "too_early" ? "too_early" : "session_over");

  const role = isTutor ? "tutor" : "student";
  if (isTutor) {
    await db
      .update(schema.classSessions)
      .set({
        tutorJoinedAt: s.tutorJoinedAt ?? now,
        status: "live",
      })
      .where(eq(schema.classSessions.id, s.id));
  } else if (isStudent && s.mode === "livekit" && !s.tutorJoinedAt) {
    throw conflict("tutor_not_joined");
  }

  if (s.mode === "external_link") {
    if (!s.meetingUrl || !isHttpsUrl(s.meetingUrl)) throw conflict("no_meeting_url");
    return { kind: "external", url: s.meetingUrl, role };
  }

  if (!(await liveModeAvailable(actor))) throw new AppError("integration_not_configured", "LiveKit");
  if (!s.roomName) throw conflict("no_room");
  const names = await displayNames([actor.id]);
  const { token, url } = await mintToken({
    identity: actor.id,
    name: firstName(names.get(actor.id) ?? actor.name),
    room: s.roomName,
    role,
    metadata: { sessionId: s.id },
    ttlSeconds: tokenTtlSeconds(s.startsAt, s.durationMin, now),
  });
  return { kind: "livekit", token, url, role };
}

/** Tutor-only room moderation. */
export async function moderateRoom(
  actor: SessionUser,
  sessionId: string,
  op: { type: "muteAll" } | { type: "remove"; identity: string },
): Promise<{ muted?: number }> {
  if (actor.role !== "tutor") throw forbidden();
  const s = await getDb().query.classSessions.findFirst({ where: eq(schema.classSessions.id, sessionId) });
  if (!s) throw notFound();
  if (s.tutorId !== actor.id) throw forbidden();
  if (s.mode !== "livekit" || !s.roomName) throw conflict("not_livekit");
  if (op.type === "muteAll") return { muted: await muteAllAudio(s.roomName, actor.id) };
  if (op.identity === actor.id) throw conflict("cannot_remove_self");
  await removeParticipant(s.roomName, op.identity);
  return {};
}

// ───────────── attendance ─────────────

export const markAttendanceSchema = z.object({
  sessionId: z.string().uuid(),
  studentId: z.string().min(1),
  status: z.enum(["present", "late", "absent", "excused"]),
});

export async function awardAttendanceXp(studentId: string, sessionId: string) {
  await awardXp(studentId, "class_attended", CLASS_ATTENDED_XP, `class_attended:${sessionId}`, { sessionId });
}

/** Tutor (of the session) or admin marks one student. XP (class_attended) is idempotent per session. */
export async function markAttendance(actor: SessionUser, input: z.infer<typeof markAttendanceSchema>): Promise<void> {
  const data = markAttendanceSchema.parse(input);
  const s = await loadOwnedSession(actor, data.sessionId);
  if (s.status === "cancelled") throw conflict("session_not_editable");
  const updated = await getDb()
    .update(schema.sessionAttendees)
    .set({ status: data.status, markedBy: "tutor" })
    .where(and(eq(schema.sessionAttendees.sessionId, s.id), eq(schema.sessionAttendees.studentId, data.studentId)))
    .returning({ studentId: schema.sessionAttendees.studentId });
  if (!updated.length) throw notFound();
  if (data.status === "present" || data.status === "late") await awardAttendanceXp(data.studentId, s.id);
}

export async function markAllPresent(actor: SessionUser, sessionId: string): Promise<{ count: number }> {
  const s = await loadOwnedSession(actor, sessionId);
  if (s.status === "cancelled") throw conflict("session_not_editable");
  const rows = await getDb()
    .update(schema.sessionAttendees)
    .set({ status: "present", markedBy: "tutor" })
    .where(and(eq(schema.sessionAttendees.sessionId, s.id), eq(schema.sessionAttendees.status, "expected")))
    .returning({ studentId: schema.sessionAttendees.studentId });
  for (const r of rows) await awardAttendanceXp(r.studentId, s.id);
  return { count: rows.length };
}

/** Attendance stats for a student over past (non-cancelled) sessions. */
export async function attendanceFor(actor: SessionUser, studentId: string): Promise<AttendanceStats> {
  if (!(await canAccessStudent(actor, studentId))) throw forbidden();
  const rows = await getDb()
    .select({ startsAt: schema.classSessions.startsAt, status: schema.sessionAttendees.status })
    .from(schema.sessionAttendees)
    .innerJoin(schema.classSessions, eq(schema.classSessions.id, schema.sessionAttendees.sessionId))
    .where(
      and(
        eq(schema.sessionAttendees.studentId, studentId),
        ne(schema.classSessions.status, "cancelled"),
        lte(schema.classSessions.startsAt, new Date()),
      ),
    );
  return attendanceStats(rows);
}

export type { WindowState };
