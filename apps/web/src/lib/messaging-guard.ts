/**
 * Pure child-safety rules for message threads. The DAL (server/dal/messages.ts)
 * loads the facts and calls these functions; they have no I/O so they are fully tested.
 *
 * HARD RULES
 * 1. A minor can never create or join a thread.
 * 2. A tutor can never be in a thread with a minor (covered by rule 1 as well).
 * 3. Threads are between staff (tutor/admin) and a parent or adult student.
 * 4. A tutor may only start a thread with a parent of a student they teach.
 */

export type MsgRole = "admin" | "tutor" | "parent" | "student";

export type Party = { id: string; role: MsgRole; isMinor: boolean };

export type GuardReason =
  | "minor_participant"
  | "same_side"
  | "tutor_not_teaching"
  | "tutor_must_target_parent"
  | "self_thread";

export type GuardResult = { ok: true } | { ok: false; reason: GuardReason };

const isStaff = (r: MsgRole) => r === "tutor" || r === "admin";

/** Is this set of members allowed to exist in one thread? (checked on start and on every send) */
export function checkThreadMembers(members: Party[]): GuardResult {
  if (members.some((m) => m.isMinor)) return { ok: false, reason: "minor_participant" };
  const staff = members.filter((m) => isStaff(m.role)).length;
  if (staff === 0 || staff === members.length) return { ok: false, reason: "same_side" };
  return { ok: true };
}

/**
 * Can `initiator` start a new thread with `recipient`?
 * `tutorTeachesLinkedStudent`: when one side is a tutor, whether that tutor teaches a student
 * linked to the other side (the parent's child, or the adult student themself). When a thread
 * is about a specific student the DAL must compute this for that student.
 */
export function canStartThread(input: {
  initiator: Party;
  recipient: Party;
  tutorTeachesLinkedStudent: boolean;
}): GuardResult {
  const { initiator, recipient } = input;
  if (initiator.id === recipient.id) return { ok: false, reason: "self_thread" };
  const members = checkThreadMembers([initiator, recipient]);
  if (!members.ok) return members;

  const hasTutor = initiator.role === "tutor" || recipient.role === "tutor";
  if (hasTutor) {
    // A tutor starting a thread may only target a parent (adult students contact tutors themselves).
    if (initiator.role === "tutor" && recipient.role !== "parent") {
      return { ok: false, reason: "tutor_must_target_parent" };
    }
    if (!input.tutorTeachesLinkedStudent) return { ok: false, reason: "tutor_not_teaching" };
  }
  return { ok: true };
}
