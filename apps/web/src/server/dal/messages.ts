import "server-only";
import { z } from "zod";
import { and, asc, count, desc, eq, getDb, gt, inArray, isNull, ne, or, schema, sql } from "@mufasa/db";
import { isMinor } from "@/lib/minor";
import { canStartThread, checkThreadMembers, type GuardReason, type Party } from "@/lib/messaging-guard";
import { AppError, forbidden, notFound } from "../errors";
import { requireFlag } from "../flags";
import { notify } from "../notify";
import { childrenOf, isParentOf, isTutorOf, type SessionUser } from "../session";
// Shared helper: minors are shown by first name only (child safety).
import { displayNames } from "./tutoring";

export const startThreadSchema = z.object({
  recipientId: z.string().min(1),
  subject: z.string().trim().min(1).max(140),
  body: z.string().trim().min(1).max(4000),
  aboutStudentId: z.string().min(1).optional(),
});
export type StartThreadInput = z.infer<typeof startThreadSchema>;

const GUARD_MESSAGE: Record<GuardReason, string> = {
  minor_participant: "minors_cannot_message",
  same_side: "invalid_participants",
  tutor_not_teaching: "tutor_not_teaching_student",
  tutor_must_target_parent: "tutors_message_parents_only",
  self_thread: "invalid_participants",
};

// ───────────── facts ─────────────

async function loadParties(ids: string[]): Promise<Map<string, Party & { name: string; banned: boolean }>> {
  if (!ids.length) return new Map();
  const rows = await getDb()
    .select({
      id: schema.user.id,
      name: schema.user.name,
      role: schema.user.role,
      banned: schema.user.banned,
      isManagedChild: schema.user.isManagedChild,
      birthYear: schema.profiles.birthYear,
    })
    .from(schema.user)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.user.id))
    .where(inArray(schema.user.id, ids));
  return new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        role: r.role,
        banned: Boolean(r.banned),
        isMinor: isMinor({ isManagedChild: r.isManagedChild, birthYear: r.birthYear, role: r.role }),
      },
    ]),
  );
}

/** Students linked to a non-staff party: a parent's children, or an adult student themself. */
async function linkedStudents(party: Party): Promise<string[]> {
  if (party.role === "parent") return childrenOf(party.id);
  if (party.role === "student") return [party.id];
  return [];
}

async function tutorTeachesLinked(tutorId: string, other: Party, aboutStudentId?: string): Promise<boolean> {
  const linked = await linkedStudents(other);
  const candidates = aboutStudentId ? linked.filter((s) => s === aboutStudentId) : linked;
  for (const s of candidates) if (await isTutorOf(tutorId, s)) return true;
  return false;
}

function assertActorMayMessage(actor: SessionUser) {
  if (actor.isManagedChild) throw forbidden("minors_cannot_message");
}

// ───────────── recipients ─────────────

export type Recipient = { id: string; name: string; role: "tutor" | "admin" | "parent"; students: { id: string; name: string }[] };

/** People the actor may start a thread with, with the students the thread can be "about". */
export async function listRecipients(actor: SessionUser): Promise<Recipient[]> {
  assertActorMayMessage(actor);
  const db = getDb();

  if (actor.role === "parent") {
    const kids = await childrenOf(actor.id);
    const out: Recipient[] = [];
    if (kids.length) {
      const direct = await db
        .select({ tutorId: schema.tutorStudents.tutorId, studentId: schema.tutorStudents.studentId })
        .from(schema.tutorStudents)
        .where(inArray(schema.tutorStudents.studentId, kids));
      const viaGroup = await db
        .select({ tutorId: schema.classGroups.tutorId, studentId: schema.classGroupMembers.studentId })
        .from(schema.classGroups)
        .innerJoin(schema.classGroupMembers, eq(schema.classGroupMembers.groupId, schema.classGroups.id))
        .where(inArray(schema.classGroupMembers.studentId, kids));
      const byTutor = new Map<string, Set<string>>();
      for (const r of [...direct, ...viaGroup]) {
        if (!r.tutorId) continue;
        (byTutor.get(r.tutorId) ?? byTutor.set(r.tutorId, new Set()).get(r.tutorId)!).add(r.studentId);
      }
      const names = await displayNames([...byTutor.keys(), ...kids]);
      for (const [tutorId, studentIds] of byTutor) {
        out.push({
          id: tutorId,
          name: names.get(tutorId) ?? "",
          role: "tutor",
          students: [...studentIds].map((id) => ({ id, name: names.get(id) ?? "" })),
        });
      }
    }
    const admins = await db
      .select({ id: schema.user.id, name: schema.user.name })
      .from(schema.user)
      .where(eq(schema.user.role, "admin"))
      .limit(10);
    for (const a of admins) out.push({ id: a.id, name: a.name, role: "admin", students: [] });
    return out;
  }

  if (actor.role === "tutor") {
    const direct = await db
      .select({ studentId: schema.tutorStudents.studentId })
      .from(schema.tutorStudents)
      .where(eq(schema.tutorStudents.tutorId, actor.id));
    const viaGroup = await db
      .select({ studentId: schema.classGroupMembers.studentId })
      .from(schema.classGroups)
      .innerJoin(schema.classGroupMembers, eq(schema.classGroupMembers.groupId, schema.classGroups.id))
      .where(eq(schema.classGroups.tutorId, actor.id));
    const students = [...new Set([...direct, ...viaGroup].map((r) => r.studentId))];
    if (!students.length) return [];
    const links = await db
      .select({ parentId: schema.parentChildren.parentId, childId: schema.parentChildren.childId })
      .from(schema.parentChildren)
      .where(inArray(schema.parentChildren.childId, students));
    const byParent = new Map<string, string[]>();
    for (const l of links) (byParent.get(l.parentId) ?? byParent.set(l.parentId, []).get(l.parentId)!).push(l.childId);
    const names = await displayNames([...byParent.keys(), ...students]);
    return [...byParent].map(([parentId, kids]) => ({
      id: parentId,
      name: names.get(parentId) ?? "",
      role: "parent" as const,
      students: kids.map((id) => ({ id, name: names.get(id) ?? "" })),
    }));
  }

  if (actor.role === "admin") {
    const parents = await db
      .select({ id: schema.user.id, name: schema.user.name })
      .from(schema.user)
      .where(eq(schema.user.role, "parent"))
      .limit(200);
    return parents.map((p) => ({ id: p.id, name: p.name, role: "parent" as const, students: [] }));
  }
  return [];
}

/** Profile display name when present (first names only for children), else the account name. */
// ───────────── threads ─────────────

export type ThreadListItem = {
  id: string;
  subject: string;
  lastMessageAt: Date;
  lastMessage: string | null;
  unread: number;
  otherNames: string[];
  aboutStudentName: string | null;
};

export async function listThreads(actor: SessionUser): Promise<ThreadListItem[]> {
  assertActorMayMessage(actor);
  const db = getDb();
  const mine = await db
    .select({
      id: schema.messageThreads.id,
      subject: schema.messageThreads.subject,
      lastMessageAt: schema.messageThreads.lastMessageAt,
      aboutStudentId: schema.messageThreads.aboutStudentId,
    })
    .from(schema.messageThreadMembers)
    .innerJoin(schema.messageThreads, eq(schema.messageThreads.id, schema.messageThreadMembers.threadId))
    .where(eq(schema.messageThreadMembers.userId, actor.id))
    .orderBy(desc(schema.messageThreads.lastMessageAt))
    .limit(100);
  if (!mine.length) return [];
  const ids = mine.map((m) => m.id);

  const others = await db
    .select({ threadId: schema.messageThreadMembers.threadId, name: schema.user.name })
    .from(schema.messageThreadMembers)
    .innerJoin(schema.user, eq(schema.user.id, schema.messageThreadMembers.userId))
    .where(and(inArray(schema.messageThreadMembers.threadId, ids), ne(schema.messageThreadMembers.userId, actor.id)));

  const unread = await db
    .select({ threadId: schema.messages.threadId, n: count() })
    .from(schema.messages)
    .innerJoin(
      schema.messageThreadMembers,
      and(eq(schema.messageThreadMembers.threadId, schema.messages.threadId), eq(schema.messageThreadMembers.userId, actor.id)),
    )
    .where(
      and(
        inArray(schema.messages.threadId, ids),
        ne(schema.messages.senderId, actor.id),
        or(isNull(schema.messageThreadMembers.lastReadAt), gt(schema.messages.createdAt, schema.messageThreadMembers.lastReadAt)),
      ),
    )
    .groupBy(schema.messages.threadId);

  const last = await db
    .selectDistinctOn([schema.messages.threadId], { threadId: schema.messages.threadId, body: schema.messages.body })
    .from(schema.messages)
    .where(inArray(schema.messages.threadId, ids))
    .orderBy(schema.messages.threadId, desc(schema.messages.createdAt));

  const aboutIds = [...new Set(mine.map((m) => m.aboutStudentId).filter((x): x is string => Boolean(x)))];
  const aboutNames = await displayNames(aboutIds);

  return mine.map((m) => ({
    id: m.id,
    subject: m.subject,
    lastMessageAt: m.lastMessageAt,
    lastMessage: last.find((l) => l.threadId === m.id)?.body.slice(0, 140) ?? null,
    unread: unread.find((u) => u.threadId === m.id)?.n ?? 0,
    otherNames: others.filter((o) => o.threadId === m.id).map((o) => o.name),
    aboutStudentName: m.aboutStudentId ? (aboutNames.get(m.aboutStudentId) ?? null) : null,
  }));
}

export type ThreadView = {
  id: string;
  subject: string;
  aboutStudentName: string | null;
  members: { id: string; name: string; role: string }[];
  messages: { id: string; senderId: string; senderName: string; body: string; createdAt: Date }[];
  /** Admin viewing a thread they are not part of (moderation). */
  readOnly: boolean;
};

export async function getThread(actor: SessionUser, threadId: string): Promise<ThreadView> {
  assertActorMayMessage(actor);
  const db = getDb();
  const thread = await db.query.messageThreads.findFirst({ where: eq(schema.messageThreads.id, threadId) });
  if (!thread) throw notFound();
  const members = await db
    .select({ id: schema.user.id, name: schema.user.name, role: schema.user.role })
    .from(schema.messageThreadMembers)
    .innerJoin(schema.user, eq(schema.user.id, schema.messageThreadMembers.userId))
    .where(eq(schema.messageThreadMembers.threadId, threadId));
  const isMember = members.some((m) => m.id === actor.id);
  if (!isMember && actor.role !== "admin") throw forbidden();

  const msgs = await db
    .select({
      id: schema.messages.id,
      senderId: schema.messages.senderId,
      senderName: schema.user.name,
      body: schema.messages.body,
      createdAt: schema.messages.createdAt,
    })
    .from(schema.messages)
    .innerJoin(schema.user, eq(schema.user.id, schema.messages.senderId))
    .where(eq(schema.messages.threadId, threadId))
    .orderBy(asc(schema.messages.createdAt))
    .limit(300);
  const about = thread.aboutStudentId ? (await displayNames([thread.aboutStudentId])).get(thread.aboutStudentId) ?? null : null;
  return { id: thread.id, subject: thread.subject, aboutStudentName: about, members, messages: msgs, readOnly: !isMember };
}

export async function startThread(actor: SessionUser, input: StartThreadInput): Promise<{ id: string }> {
  assertActorMayMessage(actor);
  await requireFlag("parent_messaging", actor);
  const data = startThreadSchema.parse(input);
  const parties = await loadParties([actor.id, data.recipientId]);
  const me = parties.get(actor.id);
  const them = parties.get(data.recipientId);
  if (!me || !them || them.banned) throw notFound();

  // Facts for the pure guard.
  let teaches = true;
  const tutor = me.role === "tutor" ? me : them.role === "tutor" ? them : null;
  const other = tutor === me ? them : me;
  if (tutor) teaches = await tutorTeachesLinked(tutor.id, other, data.aboutStudentId);

  const verdict = canStartThread({ initiator: me, recipient: them, tutorTeachesLinkedStudent: teaches });
  if (!verdict.ok) throw new AppError("forbidden", GUARD_MESSAGE[verdict.reason]);

  if (data.aboutStudentId) {
    const sid = data.aboutStudentId;
    const nonStaff = me.role === "tutor" || me.role === "admin" ? them : me;
    const ok =
      (nonStaff.role === "parent" && (await isParentOf(nonStaff.id, sid))) ||
      (nonStaff.role === "student" && nonStaff.id === sid);
    if (!ok) throw forbidden("student_not_linked");
    if (me.role === "tutor" && !(await isTutorOf(me.id, sid))) throw forbidden("tutor_not_teaching_student");
  }

  const db = getDb();
  const threadId = await db.transaction(async (tx) => {
    const [t] = await tx
      .insert(schema.messageThreads)
      .values({ subject: data.subject, aboutStudentId: data.aboutStudentId ?? null })
      .returning({ id: schema.messageThreads.id });
    await tx.insert(schema.messageThreadMembers).values([
      { threadId: t!.id, userId: me.id, lastReadAt: new Date() },
      { threadId: t!.id, userId: them.id },
    ]);
    await tx.insert(schema.messages).values({ threadId: t!.id, senderId: me.id, body: data.body });
    return t!.id;
  });
  await notify(them.id, "newMessage", { name: actor.name }, messagesHref(them.role, threadId));
  return { id: threadId };
}

export const sendMessageSchema = z.object({ threadId: z.string().uuid(), body: z.string().trim().min(1).max(4000) });

export async function sendMessage(actor: SessionUser, input: z.infer<typeof sendMessageSchema>): Promise<{ id: string }> {
  assertActorMayMessage(actor);
  await requireFlag("parent_messaging", actor);
  const data = sendMessageSchema.parse(input);
  const db = getDb();
  const memberRows = await db
    .select({ userId: schema.messageThreadMembers.userId })
    .from(schema.messageThreadMembers)
    .where(eq(schema.messageThreadMembers.threadId, data.threadId));
  if (!memberRows.some((m) => m.userId === actor.id)) throw forbidden();

  // Re-evaluate the child-safety rules on every send (a member may have changed since the thread started).
  const parties = await loadParties(memberRows.map((m) => m.userId));
  const verdict = checkThreadMembers([...parties.values()]);
  if (!verdict.ok) throw new AppError("forbidden", GUARD_MESSAGE[verdict.reason]);

  const [m] = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(schema.messages)
      .values({ threadId: data.threadId, senderId: actor.id, body: data.body })
      .returning({ id: schema.messages.id });
    await tx.update(schema.messageThreads).set({ lastMessageAt: new Date() }).where(eq(schema.messageThreads.id, data.threadId));
    await tx
      .update(schema.messageThreadMembers)
      .set({ lastReadAt: new Date() })
      .where(and(eq(schema.messageThreadMembers.threadId, data.threadId), eq(schema.messageThreadMembers.userId, actor.id)));
    return inserted;
  });
  for (const p of parties.values()) {
    if (p.id !== actor.id) await notify(p.id, "newMessage", { name: actor.name }, messagesHref(p.role, data.threadId));
  }
  return { id: m!.id };
}

export async function markRead(actor: SessionUser, threadId: string): Promise<void> {
  assertActorMayMessage(actor);
  await getDb()
    .update(schema.messageThreadMembers)
    .set({ lastReadAt: sql`now()` })
    .where(and(eq(schema.messageThreadMembers.threadId, threadId), eq(schema.messageThreadMembers.userId, actor.id)));
}

function messagesHref(role: string, threadId: string) {
  // Admins may enter any panel; students have no messages page.
  const panel = role === "parent" ? "parent" : role === "tutor" || role === "admin" ? "tutor" : null;
  return panel ? `/${panel}/messages?thread=${threadId}` : undefined;
}
