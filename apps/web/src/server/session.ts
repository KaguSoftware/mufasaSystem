import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { and, eq, getDb, isDbConfigured, schema, type Role } from "@mufasa/db";
import { getAuth } from "./auth";
import { AppError, forbidden, unauthorized } from "./errors";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  locale: string;
  timezone: string;
  isManagedChild: boolean;
  username?: string | null;
  image?: string | null;
};

/** Current session (memoized per request). Null when signed out or DB not configured. */
export const getSession = cache(async (): Promise<{ user: SessionUser; sessionId: string } | null> => {
  if (!isDbConfigured()) return null;
  const s = await getAuth().api.getSession({ headers: await headers() });
  if (!s) return null;
  const u = s.user as typeof s.user & Partial<SessionUser>;
  return {
    sessionId: s.session.id,
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      role: (u.role ?? "student") as Role,
      locale: u.locale ?? "en",
      timezone: u.timezone ?? "Europe/Istanbul",
      isManagedChild: Boolean(u.isManagedChild),
      username: u.username,
      image: u.image,
    },
  };
});

export async function requireUser(): Promise<SessionUser> {
  if (!isDbConfigured()) throw new AppError("db_not_configured");
  const s = await getSession();
  if (!s) throw unauthorized();
  return s.user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw forbidden();
  return user;
}

// ───────────── Relationship checks (authorization building blocks) ─────────────

export async function isParentOf(parentId: string, childId: string): Promise<boolean> {
  const row = await getDb().query.parentChildren.findFirst({
    where: and(eq(schema.parentChildren.parentId, parentId), eq(schema.parentChildren.childId, childId)),
    columns: { childId: true },
  });
  return Boolean(row);
}

export async function isTutorOf(tutorId: string, studentId: string): Promise<boolean> {
  const db = getDb();
  const direct = await db.query.tutorStudents.findFirst({
    where: and(eq(schema.tutorStudents.tutorId, tutorId), eq(schema.tutorStudents.studentId, studentId)),
    columns: { studentId: true },
  });
  if (direct) return true;
  const viaGroup = await db
    .select({ id: schema.classGroups.id })
    .from(schema.classGroups)
    .innerJoin(schema.classGroupMembers, eq(schema.classGroupMembers.groupId, schema.classGroups.id))
    .where(and(eq(schema.classGroups.tutorId, tutorId), eq(schema.classGroupMembers.studentId, studentId)))
    .limit(1);
  return viaGroup.length > 0;
}


/**
 * Can `actor` see (or act on) data belonging to student `studentId`?
 * - the student themself
 * - a parent of the student
 * - a tutor assigned to the student (directly or via a group)
 * - an admin
 */
export async function canAccessStudent(actor: SessionUser, studentId: string): Promise<boolean> {
  if (actor.id === studentId || actor.role === "admin") return true;
  if (actor.role === "parent") return isParentOf(actor.id, studentId);
  if (actor.role === "tutor") return isTutorOf(actor.id, studentId);
  return false;
}

export async function assertCanAccessStudent(actor: SessionUser, studentId: string): Promise<void> {
  if (!(await canAccessStudent(actor, studentId))) throw forbidden();
}

/** Ids of children of a parent. */
export async function childrenOf(parentId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ id: schema.parentChildren.childId })
    .from(schema.parentChildren)
    .where(eq(schema.parentChildren.parentId, parentId));
  return rows.map((r) => r.id);
}

/** Age from birth year (approximate, birth year only by design). */
export function ageFromBirthYear(birthYear: number | null | undefined, now = new Date()): number | null {
  return birthYear ? now.getFullYear() - birthYear : null;
}

export const ADULT_AGE = 18;
