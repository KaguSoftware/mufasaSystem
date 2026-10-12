import "server-only";
import { headers } from "next/headers";
import { z } from "zod";
import { and, count, desc, eq, getDb, ilike, inArray, or, schema, ROLES, type Role } from "@mufasa/db";
import { audit } from "../audit";
import { getAuth } from "../auth";
import { AppError, forbidden, notFound } from "../errors";
import type { SessionUser } from "../session";

export const USERS_PAGE_SIZE = 20;

function requireAdmin(actor: SessionUser) {
  if (actor.role !== "admin") throw forbidden();
}

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: Role;
  banned: boolean;
  isManagedChild: boolean;
  createdAt: Date;
};

export async function listUsers(
  actor: SessionUser,
  opts: { q?: string; role?: Role; page?: number } = {},
): Promise<{ rows: AdminUserRow[]; total: number; page: number; pageSize: number }> {
  requireAdmin(actor);
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const q = opts.q?.trim();
  const like = q ? `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
  const where = and(
    opts.role ? eq(schema.user.role, opts.role) : undefined,
    like
      ? or(ilike(schema.user.name, like), ilike(schema.user.email, like), ilike(schema.user.username, like))
      : undefined,
  );
  const db = getDb();
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        username: schema.user.username,
        role: schema.user.role,
        banned: schema.user.banned,
        isManagedChild: schema.user.isManagedChild,
        createdAt: schema.user.createdAt,
      })
      .from(schema.user)
      .where(where)
      .orderBy(desc(schema.user.createdAt))
      .limit(USERS_PAGE_SIZE)
      .offset((page - 1) * USERS_PAGE_SIZE),
    db.select({ n: count() }).from(schema.user).where(where),
  ]);
  return { rows: rows.map((r) => ({ ...r, banned: Boolean(r.banned) })), total: total?.n ?? 0, page, pageSize: USERS_PAGE_SIZE };
}

export type FamilyLinks = {
  parents: { id: string; name: string; email: string }[];
  children: { id: string; name: string; username: string | null }[];
};

export async function getFamilyLinks(actor: SessionUser, userId: string): Promise<FamilyLinks> {
  requireAdmin(actor);
  const db = getDb();
  const [parentLinks, childLinks] = await Promise.all([
    db.select({ id: schema.parentChildren.parentId }).from(schema.parentChildren).where(eq(schema.parentChildren.childId, userId)),
    db.select({ id: schema.parentChildren.childId }).from(schema.parentChildren).where(eq(schema.parentChildren.parentId, userId)),
  ]);
  const ids = [...parentLinks, ...childLinks].map((l) => l.id);
  if (!ids.length) return { parents: [], children: [] };
  const users = await db
    .select({ id: schema.user.id, name: schema.user.name, email: schema.user.email, username: schema.user.username })
    .from(schema.user)
    .where(inArray(schema.user.id, ids));
  const byId = new Map(users.map((u) => [u.id, u]));
  return {
    parents: parentLinks.map((l) => byId.get(l.id)).filter((u): u is NonNullable<typeof u> => Boolean(u)).map((u) => ({ id: u.id, name: u.name, email: u.email })),
    children: childLinks.map((l) => byId.get(l.id)).filter((u): u is NonNullable<typeof u> => Boolean(u)).map((u) => ({ id: u.id, name: u.name, username: u.username })),
  };
}

async function loadTarget(userId: string) {
  const u = await getDb().query.user.findFirst({ where: eq(schema.user.id, userId) });
  if (!u) throw notFound();
  return u;
}

// ───────────── Better Auth admin API wrappers (all audited) ─────────────

export const createStaffSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10).max(128),
  role: z.enum(["tutor", "admin"]),
});

/** Creates a tutor/admin with a temporary password through Better Auth's admin plugin (`auth.api.createUser`). */
export async function createStaffUser(actor: SessionUser, input: z.infer<typeof createStaffSchema>): Promise<{ id: string }> {
  requireAdmin(actor);
  const data = createStaffSchema.parse(input);
  const exists = await getDb().query.user.findFirst({ where: eq(schema.user.email, data.email), columns: { id: true } });
  if (exists) throw new AppError("conflict", "email_taken", { email: ["taken"] });
  const res = await getAuth().api.createUser({
    body: { email: data.email, password: data.password, name: data.name, role: data.role as unknown as "user" },
    headers: await headers(),
  });
  const id = res.user.id;
  await getDb()
    .insert(schema.profiles)
    .values({ userId: id, displayName: data.name })
    .onConflictDoNothing();
  await getDb().update(schema.user).set({ emailVerified: true }).where(eq(schema.user.id, id));
  await audit({ actorId: actor.id, action: "user.create_staff", entity: "user", entityId: id, after: { email: data.email, role: data.role } });
  return { id };
}

export const setRoleSchema = z.object({ userId: z.string().min(1), role: z.enum(ROLES) });

export async function setUserRole(actor: SessionUser, input: z.infer<typeof setRoleSchema>): Promise<void> {
  requireAdmin(actor);
  const data = setRoleSchema.parse(input);
  if (data.userId === actor.id) throw new AppError("forbidden", "cannot_change_own_role");
  const target = await loadTarget(data.userId);
  if (target.isManagedChild && data.role !== "student") throw new AppError("forbidden", "child_accounts_are_students");
  await getAuth().api.setRole({ body: { userId: data.userId, role: data.role as unknown as "user" }, headers: await headers() });
  await audit({
    actorId: actor.id,
    action: "user.role_change",
    entity: "user",
    entityId: data.userId,
    before: { role: target.role },
    after: { role: data.role },
  });
}

export const banSchema = z.object({ userId: z.string().min(1), reason: z.string().trim().max(200).optional() });

export async function banUser(actor: SessionUser, input: z.infer<typeof banSchema>): Promise<void> {
  requireAdmin(actor);
  const data = banSchema.parse(input);
  if (data.userId === actor.id) throw new AppError("forbidden", "cannot_ban_self");
  const target = await loadTarget(data.userId);
  await getAuth().api.banUser({ body: { userId: data.userId, banReason: data.reason }, headers: await headers() });
  await audit({
    actorId: actor.id,
    action: "user.ban",
    entity: "user",
    entityId: data.userId,
    before: { banned: Boolean(target.banned) },
    after: { banned: true, reason: data.reason ?? null },
  });
}

export async function unbanUser(actor: SessionUser, userId: string): Promise<void> {
  requireAdmin(actor);
  const target = await loadTarget(userId);
  await getAuth().api.unbanUser({ body: { userId }, headers: await headers() });
  await audit({ actorId: actor.id, action: "user.unban", entity: "user", entityId: userId, before: { banned: Boolean(target.banned) }, after: { banned: false } });
}

/** Starts an impersonation session (cookie is set by the nextCookies plugin). Admins cannot be impersonated. */
export async function impersonate(actor: SessionUser, userId: string): Promise<void> {
  requireAdmin(actor);
  const target = await loadTarget(userId);
  if (target.role === "admin") throw new AppError("forbidden", "cannot_impersonate_admin");
  await audit({ actorId: actor.id, action: "user.impersonate", entity: "user", entityId: userId, after: { role: target.role } });
  await getAuth().api.impersonateUser({ body: { userId }, headers: await headers() });
}

export async function stopImpersonating(actor: SessionUser): Promise<void> {
  await getAuth().api.stopImpersonating({ headers: await headers() });
  await audit({ actorId: actor.id, action: "user.stop_impersonating", entity: "user", entityId: actor.id });
}
