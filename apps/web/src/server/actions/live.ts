"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "../action";
import * as live from "../dal/live";
import * as bookings from "../dal/live-bookings";

function refresh(...pages: string[]) {
  for (const p of pages) revalidatePath(`/[locale]/${p}`, "page");
}

// ───────────── groups (admin) ─────────────

export const createGroup = action({ input: live.groupInputSchema, roles: ["admin"] }, async (input, { user }) => {
  const res = await live.createGroup(user, input);
  refresh("admin/groups", "tutor/groups");
  return res;
});

export const updateGroup = action(
  { input: z.object({ groupId: z.string().uuid(), data: live.groupInputSchema }), roles: ["admin"] },
  async ({ groupId, data }, { user }) => {
    await live.updateGroup(user, groupId, data);
    refresh("admin/groups", "tutor/groups", "tutor/sessions");
    return { ok: true as const };
  },
);

const memberInput = z.object({ groupId: z.string().uuid(), studentId: z.string().min(1) });

export const addGroupMember = action({ input: memberInput, roles: ["admin"] }, async (input, { user }) => {
  await live.addGroupMember(user, input.groupId, input.studentId);
  refresh("admin/groups", "tutor/groups");
  return { ok: true as const };
});

export const removeGroupMember = action({ input: memberInput, roles: ["admin"] }, async (input, { user }) => {
  await live.removeGroupMember(user, input.groupId, input.studentId);
  refresh("admin/groups", "tutor/groups");
  return { ok: true as const };
});

// ───────────── sessions ─────────────

export const scheduleSessions = action(
  { input: live.scheduleSchema, roles: ["tutor", "admin"] },
  async (input, { user }) => {
    const res = await live.scheduleSessions(user, input);
    refresh("tutor/sessions", "student/classes", "parent/bookings");
    return res;
  },
);

export const editSession = action({ input: live.editSessionSchema, roles: ["tutor", "admin"] }, async (input, { user }) => {
  await live.editSession(user, input);
  refresh("tutor/sessions", "student/classes", "parent/bookings");
  return { ok: true as const };
});

export const cancelSession = action(
  { input: z.object({ sessionId: z.string().uuid() }), roles: ["tutor", "admin"] },
  async ({ sessionId }, { user }) => {
    await live.cancelSession(user, sessionId);
    refresh("tutor/sessions", "student/classes", "parent/bookings");
    return { ok: true as const };
  },
);

export const markAttendance = action(
  { input: live.markAttendanceSchema, roles: ["tutor", "admin"] },
  async (input, { user }) => {
    await live.markAttendance(user, input);
    refresh("tutor/sessions", "student/classes");
    return { ok: true as const };
  },
);

export const markAllPresent = action(
  { input: z.object({ sessionId: z.string().uuid() }), roles: ["tutor", "admin"] },
  async ({ sessionId }, { user }) => {
    const res = await live.markAllPresent(user, sessionId);
    refresh("tutor/sessions", "student/classes");
    return res;
  },
);

export const moderateRoom = action(
  {
    input: z.object({
      sessionId: z.string().uuid(),
      op: z.discriminatedUnion("type", [
        z.object({ type: z.literal("muteAll") }),
        z.object({ type: z.literal("remove"), identity: z.string().min(1) }),
      ]),
    }),
    roles: ["tutor"],
    rateLimit: "live.token",
  },
  async ({ sessionId, op }, { user }) => live.moderateRoom(user, sessionId, op),
);

// ───────────── availability & bookings ─────────────

export const saveWeeklyAvailability = action(
  { input: bookings.saveWeeklySchema, roles: ["tutor"] },
  async (input, { user }) => {
    await bookings.saveWeeklyAvailability(user, input);
    refresh("tutor/availability", "parent/bookings");
    return { ok: true as const };
  },
);

export const addAvailabilityException = action(
  { input: bookings.addExceptionSchema, roles: ["tutor"] },
  async (input, { user }) => {
    const res = await bookings.addAvailabilityException(user, input);
    refresh("tutor/availability", "parent/bookings");
    return res;
  },
);

export const removeAvailabilityException = action(
  { input: z.object({ id: z.string().uuid() }), roles: ["tutor"] },
  async ({ id }, { user }) => {
    await bookings.removeAvailabilityException(user, id);
    refresh("tutor/availability", "parent/bookings");
    return { ok: true as const };
  },
);

export const fetchSlots = action(
  {
    input: z.object({ tutorId: z.string().min(1), days: z.number().int().min(1).max(28).optional() }),
    roles: ["parent", "student", "admin"],
  },
  async (input, { user }) => bookings.availableSlots(user, input),
);

export const requestBooking = action(
  { input: bookings.requestBookingSchema, roles: ["parent", "student"], rateLimit: "live.booking" },
  async (input, { user }) => {
    const res = await bookings.requestBooking(user, input);
    refresh("parent/bookings", "tutor/sessions");
    return res;
  },
);

export const respondToBooking = action(
  { input: bookings.respondBookingSchema, roles: ["tutor"] },
  async (input, { user }) => {
    const res = await bookings.respondToBooking(user, input);
    refresh("tutor/sessions", "parent/bookings", "student/classes");
    return res;
  },
);

export const cancelBooking = action(
  { input: z.object({ bookingId: z.string().uuid() }) },
  async ({ bookingId }, { user }) => {
    await bookings.cancelBooking(user, bookingId);
    refresh("tutor/sessions", "parent/bookings", "student/classes");
    return { ok: true as const };
  },
);

/** Read helper for client dialogs (attendance sheet). Authorization is inside sessionDetail. */
export const fetchSessionDetail = action({ input: z.object({ sessionId: z.string().uuid() }) }, async ({ sessionId }, { user }) =>
  live.sessionDetail(user, sessionId),
);
