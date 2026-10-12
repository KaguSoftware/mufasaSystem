import "server-only";
import { z } from "zod";
import { and, asc, desc, eq, getDb, gt, inArray, lt, ne, schema, sql } from "@mufasa/db";
import { sessionEnd, isHttpsUrl, localDateTimeToUtc } from "@/lib/live-window";
import {
  calendarDate,
  computeSlots,
  slotsCover,
  validateWeekly,
  isValidTimeZone,
  type WeeklyRange,
} from "@/lib/slots";
import { toLocalInput } from "@/components/live/format";
import { AppError, conflict, forbidden, notFound } from "../errors";
import { notifyWithTime, displayNames, guardiansOf, liveModeAvailable } from "./live";
import { childAllows } from "./family";
import { isParentOf, type SessionUser } from "../session";

const HOUR = 3_600_000;

// ───────────── tutor availability ─────────────

const weeklySchema = z.array(
  z.object({
    day: z.number().int().min(0).max(6),
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  }),
);

export const saveWeeklySchema = z.object({ ranges: weeklySchema.max(70) });

export const addExceptionSchema = z.object({
  /** Wall times in the tutor's timezone, "yyyy-MM-ddTHH:mm". */
  startsAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  endsAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  kind: z.enum(["unavailable", "extra"]),
});

function requireTutor(actor: SessionUser) {
  if (actor.role !== "tutor") throw forbidden();
}

export type AvailabilityView = {
  timezone: string;
  /** Tomorrow at the current time, as "yyyy-MM-ddTHH:mm" in the tutor timezone (default for new exceptions). */
  suggestedStart: string;
  ranges: WeeklyRange[];
  exceptions: { id: string; startsAt: Date; endsAt: Date; kind: "unavailable" | "extra" }[];
};

export async function getMyAvailability(actor: SessionUser): Promise<AvailabilityView> {
  requireTutor(actor);
  const db = getDb();
  const [profile, exceptions] = await Promise.all([
    db.query.tutorProfiles.findFirst({ where: eq(schema.tutorProfiles.userId, actor.id), columns: { availability: true } }),
    db
      .select()
      .from(schema.tutorAvailabilityExceptions)
      .where(
        and(
          eq(schema.tutorAvailabilityExceptions.tutorId, actor.id),
          gt(schema.tutorAvailabilityExceptions.endsAt, new Date()),
        ),
      )
      .orderBy(asc(schema.tutorAvailabilityExceptions.startsAt)),
  ]);
  return {
    timezone: actor.timezone,
    suggestedStart: toLocalInput(new Date(Date.now() + 24 * HOUR), actor.timezone),
    ranges: profile?.availability ?? [],
    exceptions: exceptions.map((e) => ({ id: e.id, startsAt: e.startsAt, endsAt: e.endsAt, kind: e.kind })),
  };
}

export async function saveWeeklyAvailability(actor: SessionUser, input: z.input<typeof saveWeeklySchema>): Promise<void> {
  requireTutor(actor);
  const { ranges } = saveWeeklySchema.parse(input);
  const typed = ranges as WeeklyRange[];
  if (!validateWeekly(typed)) throw new AppError("validation", "ranges", { ranges: ["invalid_ranges"] });
  await getDb()
    .insert(schema.tutorProfiles)
    .values({ userId: actor.id, availability: typed })
    .onConflictDoUpdate({ target: schema.tutorProfiles.userId, set: { availability: typed } });
}

export async function addAvailabilityException(actor: SessionUser, input: z.input<typeof addExceptionSchema>): Promise<{ id: string }> {
  requireTutor(actor);
  const data = addExceptionSchema.parse(input);
  const startsAt = localDateTimeToUtc(data.startsAtLocal, actor.timezone);
  const endsAt = localDateTimeToUtc(data.endsAtLocal, actor.timezone);
  if (!startsAt || !endsAt || endsAt <= startsAt) {
    throw new AppError("validation", "endsAt", { endsAtLocal: ["invalid_range"] });
  }
  const [row] = await getDb()
    .insert(schema.tutorAvailabilityExceptions)
    .values({ tutorId: actor.id, startsAt, endsAt, kind: data.kind })
    .returning({ id: schema.tutorAvailabilityExceptions.id });
  return { id: row!.id };
}

export async function removeAvailabilityException(actor: SessionUser, id: string): Promise<void> {
  requireTutor(actor);
  await getDb()
    .delete(schema.tutorAvailabilityExceptions)
    .where(and(eq(schema.tutorAvailabilityExceptions.id, id), eq(schema.tutorAvailabilityExceptions.tutorId, actor.id)));
}

// ───────────── slots ─────────────

export type BookableTutor = { id: string; name: string; headline: string | null; timezone: string };

/** Public tutors who have weekly availability or extra slots configured. */
export async function bookableTutors(actor: SessionUser): Promise<BookableTutor[]> {
  if (actor.role !== "parent" && actor.role !== "student" && actor.role !== "admin") throw forbidden();
  const rows = await getDb()
    .select({
      id: schema.user.id,
      name: schema.user.name,
      displayName: schema.profiles.displayName,
      timezone: schema.user.timezone,
      headline: schema.tutorProfiles.headline,
      availability: schema.tutorProfiles.availability,
    })
    .from(schema.tutorProfiles)
    .innerJoin(schema.user, eq(schema.user.id, schema.tutorProfiles.userId))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.user.id))
    .where(and(eq(schema.user.role, "tutor"), eq(schema.tutorProfiles.isPublic, true)));
  return rows
    .filter((r) => r.availability.length > 0)
    .map((r) => ({ id: r.id, name: r.displayName ?? r.name, headline: r.headline, timezone: r.timezone }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type SlotView = { startsAt: string; endsAt: string };

async function slotsFor(tutorId: string, fromDate: string | undefined, days: number, now = new Date()) {
  const db = getDb();
  const tutor = await db.query.user.findFirst({ where: eq(schema.user.id, tutorId), columns: { role: true, timezone: true } });
  if (!tutor || tutor.role !== "tutor") throw notFound();
  const tz = isValidTimeZone(tutor.timezone) ? tutor.timezone : "Europe/Istanbul";
  const from = fromDate ?? calendarDate(now, tz);
  const rangeStart = new Date(now.getTime() - 24 * HOUR);
  const rangeEnd = new Date(now.getTime() + (days + 2 + (fromDate ? 60 : 0)) * 24 * HOUR);
  const [profile, exceptions, sessions, pending] = await Promise.all([
    db.query.tutorProfiles.findFirst({ where: eq(schema.tutorProfiles.userId, tutorId), columns: { availability: true } }),
    db
      .select()
      .from(schema.tutorAvailabilityExceptions)
      .where(
        and(
          eq(schema.tutorAvailabilityExceptions.tutorId, tutorId),
          gt(schema.tutorAvailabilityExceptions.endsAt, rangeStart),
          lt(schema.tutorAvailabilityExceptions.startsAt, rangeEnd),
        ),
      ),
    db
      .select({ startsAt: schema.classSessions.startsAt, durationMin: schema.classSessions.durationMin })
      .from(schema.classSessions)
      .where(
        and(
          eq(schema.classSessions.tutorId, tutorId),
          ne(schema.classSessions.status, "cancelled"),
          gt(schema.classSessions.startsAt, rangeStart),
          lt(schema.classSessions.startsAt, rangeEnd),
        ),
      ),
    db
      .select({ startsAt: schema.bookings.startsAt, durationMin: schema.bookings.durationMin })
      .from(schema.bookings)
      .where(and(eq(schema.bookings.tutorId, tutorId), eq(schema.bookings.status, "pending"), gt(schema.bookings.startsAt, rangeStart))),
  ]);
  const slots = computeSlots({
    availability: profile?.availability ?? [],
    timeZone: tz,
    fromDate: from,
    days,
    now,
    unavailable: exceptions.filter((e) => e.kind === "unavailable").map((e) => ({ start: e.startsAt, end: e.endsAt })),
    extra: exceptions.filter((e) => e.kind === "extra").map((e) => ({ start: e.startsAt, end: e.endsAt })),
    busy: [...sessions, ...pending].map((b) => ({ start: b.startsAt, end: sessionEnd(b.startsAt, b.durationMin) })),
  });
  return { slots, timezone: tz };
}

/** Free 30 minute slots for a tutor over the next `days` days (default 14, max 28). */
export async function availableSlots(
  actor: SessionUser,
  opts: { tutorId: string; fromDate?: string; days?: number },
): Promise<{ timezone: string; slots: SlotView[] }> {
  if (actor.role === "tutor" && actor.id !== opts.tutorId) throw forbidden();
  const days = Math.min(Math.max(opts.days ?? 14, 1), 28);
  const { slots, timezone } = await slotsFor(opts.tutorId, opts.fromDate, days);
  return { timezone, slots: slots.map((s) => ({ startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString() })) };
}

// ───────────── bookings ─────────────

export const requestBookingSchema = z.object({
  tutorId: z.string().min(1),
  studentId: z.string().min(1),
  startsAt: z.string().datetime(),
  durationMin: z.union([z.literal(30), z.literal(60)]).default(30),
  note: z.string().trim().max(500).nullable().optional(),
});

/** Parent (for their child) or an adult student requests a 1:1. Starts as pending. */
export async function requestBooking(actor: SessionUser, input: z.input<typeof requestBookingSchema>): Promise<{ id: string }> {
  const data = requestBookingSchema.parse(input);
  const db = getDb();
  if (actor.role === "parent") {
    if (!(await isParentOf(actor.id, data.studentId))) throw forbidden();
  } else if (actor.role === "student") {
    if (actor.id !== data.studentId || actor.isManagedChild) throw forbidden();
  } else throw forbidden();

  if (!(await childAllows(data.studentId, "allowLiveVideo"))) throw new AppError("forbidden", "consent_live_video");

  const startsAt = new Date(data.startsAt);
  const { slots } = await slotsFor(data.tutorId, undefined, 28);
  if (!slotsCover(slots, startsAt, data.durationMin)) throw conflict("slot_taken");

  const dupe = await db.query.bookings.findFirst({
    where: and(eq(schema.bookings.tutorId, data.tutorId), eq(schema.bookings.startsAt, startsAt), inArray(schema.bookings.status, ["pending", "confirmed"])),
    columns: { id: true },
  });
  if (dupe) throw conflict("slot_taken");

  const [row] = await db
    .insert(schema.bookings)
    .values({
      tutorId: data.tutorId,
      studentId: data.studentId,
      bookedBy: actor.id,
      startsAt,
      durationMin: data.durationMin,
      note: data.note ?? null,
    })
    .returning({ id: schema.bookings.id });
  const names = await displayNames([data.studentId]);
  await notifyWithTime([data.tutorId], "bookingRequested", startsAt, { name: names.get(data.studentId) ?? "" }, "/tutor/sessions");
  return { id: row!.id };
}

export type BookingRow = {
  id: string;
  tutorId: string;
  tutorName: string;
  studentId: string;
  studentName: string;
  startsAt: Date;
  durationMin: number;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  note: string | null;
  sessionId: string | null;
};

/** Tutor: incoming. Parent: their children's. Student: own. Only recent and upcoming bookings. */
export async function listBookings(actor: SessionUser): Promise<BookingRow[]> {
  const db = getDb();
  let where;
  if (actor.role === "tutor") where = eq(schema.bookings.tutorId, actor.id);
  else if (actor.role === "student") where = eq(schema.bookings.studentId, actor.id);
  else if (actor.role === "parent") {
    const kids = await db
      .select({ id: schema.parentChildren.childId })
      .from(schema.parentChildren)
      .where(eq(schema.parentChildren.parentId, actor.id));
    if (!kids.length) return [];
    where = inArray(schema.bookings.studentId, kids.map((k) => k.id));
  } else if (actor.role === "admin") where = undefined;
  else throw forbidden();
  const rows = await db
    .select()
    .from(schema.bookings)
    .where(and(where, gt(schema.bookings.startsAt, new Date(Date.now() - 7 * 24 * HOUR))))
    .orderBy(desc(schema.bookings.startsAt))
    .limit(100);
  const names = await displayNames(rows.flatMap((r) => [r.tutorId, r.studentId]));
  return rows.map((r) => ({
    id: r.id,
    tutorId: r.tutorId,
    tutorName: names.get(r.tutorId) ?? "",
    studentId: r.studentId,
    studentName: names.get(r.studentId) ?? "",
    startsAt: r.startsAt,
    durationMin: r.durationMin,
    status: r.status,
    note: r.note,
    sessionId: r.sessionId,
  }));
}

export const respondBookingSchema = z.object({
  bookingId: z.string().uuid(),
  decision: z.enum(["confirm", "decline"]),
  /** Needed when LiveKit is unavailable: the Meet/Zoom link for this 1:1. */
  meetingUrl: z.string().trim().max(500).nullable().optional(),
});

async function bookingAudience(studentId: string, bookedBy: string) {
  const guardians = await guardiansOf([studentId]);
  return [...new Set([studentId, bookedBy, ...(guardians.get(studentId) ?? [])])];
}

/** Tutor confirms (creates the 1:1 session) or declines. */
export async function respondToBooking(actor: SessionUser, input: z.input<typeof respondBookingSchema>): Promise<{ sessionId: string | null }> {
  requireTutor(actor);
  const data = respondBookingSchema.parse(input);
  const db = getDb();
  const b = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, data.bookingId) });
  if (!b) throw notFound();
  if (b.tutorId !== actor.id) throw forbidden();
  if (b.status !== "pending") throw conflict("booking_not_pending");
  const audience = await bookingAudience(b.studentId, b.bookedBy);

  if (data.decision === "decline") {
    await db.update(schema.bookings).set({ status: "cancelled" }).where(eq(schema.bookings.id, b.id));
    await notifyWithTime(audience, "bookingDeclined", b.startsAt, {}, undefined);
    return { sessionId: null };
  }

  if (b.startsAt.getTime() < Date.now()) throw conflict("slot_past");
  const useLivekit = await liveModeAvailable(actor);
  if (!useLivekit && !(data.meetingUrl && isHttpsUrl(data.meetingUrl))) {
    throw new AppError("validation", "meetingUrl", { meetingUrl: ["https_required"] });
  }
  const end = sessionEnd(b.startsAt, b.durationMin);
  const clash = await db
    .select({ id: schema.classSessions.id })
    .from(schema.classSessions)
    .where(
      and(
        eq(schema.classSessions.tutorId, actor.id),
        ne(schema.classSessions.status, "cancelled"),
        lt(schema.classSessions.startsAt, end),
        sql`${schema.classSessions.startsAt} + (${schema.classSessions.durationMin} * interval '1 minute') > ${b.startsAt}`,
      ),
    )
    .limit(1);
  if (clash.length) throw conflict("tutor_busy");

  const names = await displayNames([b.studentId]);
  const sessionId = await db.transaction(async (tx) => {
    const [s] = await tx
      .insert(schema.classSessions)
      .values({
        groupId: null,
        tutorId: actor.id,
        title: `1:1 ${names.get(b.studentId) ?? ""}`.trim(),
        startsAt: b.startsAt,
        durationMin: b.durationMin,
        mode: useLivekit ? "livekit" : "external_link",
        meetingUrl: useLivekit ? null : data.meetingUrl!,
        roomName: useLivekit ? `mufasa-${crypto.randomUUID()}` : null,
      })
      .returning({ id: schema.classSessions.id });
    await tx.insert(schema.sessionAttendees).values({ sessionId: s!.id, studentId: b.studentId });
    await tx.update(schema.bookings).set({ status: "confirmed", sessionId: s!.id }).where(eq(schema.bookings.id, b.id));
    return s!.id;
  });
  await notifyWithTime(audience, "bookingConfirmed", b.startsAt, {}, undefined);
  return { sessionId };
}

/** Booker, the student, the tutor or an admin cancels a pending/confirmed booking (and its session). */
export async function cancelBooking(actor: SessionUser, bookingId: string): Promise<void> {
  const db = getDb();
  const b = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, bookingId) });
  if (!b) throw notFound();
  const allowed =
    actor.role === "admin" ||
    actor.id === b.tutorId ||
    actor.id === b.bookedBy ||
    actor.id === b.studentId ||
    (actor.role === "parent" && (await isParentOf(actor.id, b.studentId)));
  if (!allowed) throw forbidden();
  if (b.status !== "pending" && b.status !== "confirmed") throw conflict("booking_not_pending");
  await db.transaction(async (tx) => {
    await tx.update(schema.bookings).set({ status: "cancelled" }).where(eq(schema.bookings.id, b.id));
    if (b.sessionId) {
      await tx.update(schema.classSessions).set({ status: "cancelled" }).where(eq(schema.classSessions.id, b.sessionId));
    }
  });
  const audience = (await bookingAudience(b.studentId, b.bookedBy)).concat(b.tutorId).filter((id) => id !== actor.id);
  await notifyWithTime(audience, "classCancelled", b.startsAt, { title: "1:1" }, undefined);
}

