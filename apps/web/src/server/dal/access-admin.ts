import "server-only";
import { z } from "zod";
import { and, desc, eq, getDb, ilike, inArray, or, schema } from "@mufasa/db";
import { t18n } from "@mufasa/config/locales";
import { summarizeAccess } from "@/lib/billing-math";
import { activeGrantsFor, activeSeatsFor } from "../access";
import { audit } from "../audit";
import { AppError, conflict, forbidden, notFound } from "../errors";
import { notify } from "../notify";
import type { SessionUser } from "../session";

function assertAdmin(actor: SessionUser) {
  if (actor.role !== "admin") throw forbidden();
}

const escapeLike = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);

export type UserHit = { id: string; name: string; email: string; username: string | null; role: string };

export async function searchUsers(actor: SessionUser, query: string): Promise<UserHit[]> {
  assertAdmin(actor);
  const q = query.trim();
  if (q.length < 2) return [];
  const like = `%${escapeLike(q)}%`;
  return getDb()
    .select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      username: schema.user.username,
      role: schema.user.role,
    })
    .from(schema.user)
    .where(or(ilike(schema.user.name, like), ilike(schema.user.email, like), ilike(schema.user.username, like)))
    .orderBy(schema.user.name)
    .limit(20);
}

export type GrantView = {
  id: string;
  scope: "all" | "program" | "course";
  targetName: string | null;
  startsAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  reason: string | null;
  state: "active" | "expired" | "revoked" | "scheduled";
};

export type UserAccessView = {
  user: UserHit;
  status: { active: boolean; forever: boolean; until: string | null };
  grants: GrantView[];
  subscriptions: {
    id: string;
    planName: string;
    source: "iyzico" | "manual";
    status: string;
    periodEnd: string | null;
    payerName: string;
  }[];
};

export async function listUserAccess(actor: SessionUser, userId: string): Promise<UserAccessView> {
  assertAdmin(actor);
  const db = getDb();
  const u = await db.query.user.findFirst({
    where: eq(schema.user.id, userId),
    columns: { id: true, name: true, email: true, username: true, role: true },
  });
  if (!u) throw notFound();

  const [grants, seats, grantRows, subRows] = await Promise.all([
    activeGrantsFor(userId),
    activeSeatsFor(userId),
    db
      .select({
        g: schema.accessGrants,
        programName: schema.programs.name,
        courseTitle: schema.courses.title,
      })
      .from(schema.accessGrants)
      .leftJoin(schema.programs, eq(schema.programs.id, schema.accessGrants.programId))
      .leftJoin(schema.courses, eq(schema.courses.id, schema.accessGrants.courseId))
      .where(eq(schema.accessGrants.userId, userId))
      .orderBy(desc(schema.accessGrants.createdAt))
      .limit(50),
    db
      .select({ s: schema.subscriptions, plan: schema.plans, payerName: schema.user.name })
      .from(schema.subscriptionSeats)
      .innerJoin(schema.subscriptions, eq(schema.subscriptions.id, schema.subscriptionSeats.subscriptionId))
      .innerJoin(schema.plans, eq(schema.plans.id, schema.subscriptions.planId))
      .innerJoin(schema.user, eq(schema.user.id, schema.subscriptions.payerId))
      .where(eq(schema.subscriptionSeats.userId, userId))
      .orderBy(desc(schema.subscriptions.createdAt))
      .limit(50),
  ]);
  const sum = summarizeAccess(grants, seats);
  const now = new Date();
  return {
    user: u,
    status: { active: sum.active, forever: sum.forever, until: sum.until?.toISOString() ?? null },
    grants: grantRows.map(({ g, programName, courseTitle }) => ({
      id: g.id,
      scope: g.scope,
      targetName: g.scope === "program" ? t18n(programName, actor.locale) : g.scope === "course" ? t18n(courseTitle, actor.locale) : null,
      startsAt: g.startsAt.toISOString(),
      expiresAt: g.expiresAt?.toISOString() ?? null,
      revokedAt: g.revokedAt?.toISOString() ?? null,
      reason: g.reason,
      state: g.revokedAt ? "revoked" : g.startsAt > now ? "scheduled" : g.expiresAt && g.expiresAt <= now ? "expired" : "active",
    })),
    subscriptions: subRows.map(({ s, plan, payerName }) => ({
      id: s.id,
      planName: t18n(plan.name, actor.locale),
      source: s.source,
      status: s.status,
      periodEnd: s.currentPeriodEnd?.toISOString() ?? null,
      payerName,
    })),
  };
}

export const grantInputSchema = z
  .object({
    userId: z.string().min(1),
    scope: z.enum(["all", "program", "course"]),
    programId: z.string().uuid().nullish(),
    courseId: z.string().uuid().nullish(),
    /** ISO datetime, or null for no expiry. */
    expiresAt: z.string().datetime().nullable(),
    reason: z.string().trim().min(2).max(500),
  })
  .refine((g) => g.scope !== "program" || g.programId, { message: "required", path: ["programId"] })
  .refine((g) => g.scope !== "course" || g.courseId, { message: "required", path: ["courseId"] });

function parseFuture(iso: string | null): Date | null {
  if (iso === null) return null;
  const d = new Date(iso);
  if (d <= new Date()) throw new AppError("validation", "expiresAt", { expiresAt: ["past"] });
  return d;
}

export async function grantAccess(actor: SessionUser, input: z.output<typeof grantInputSchema>) {
  assertAdmin(actor);
  const db = getDb();
  const target = await db.query.user.findFirst({ where: eq(schema.user.id, input.userId), columns: { id: true } });
  if (!target) throw notFound();
  const expiresAt = parseFuture(input.expiresAt);

  let scopeLabel = "all";
  if (input.scope === "program") {
    const p = await db.query.programs.findFirst({ where: eq(schema.programs.id, input.programId!), columns: { name: true } });
    if (!p) throw notFound();
    scopeLabel = t18n(p.name, "en");
  } else if (input.scope === "course") {
    const c = await db.query.courses.findFirst({ where: eq(schema.courses.id, input.courseId!), columns: { title: true } });
    if (!c) throw notFound();
    scopeLabel = t18n(c.title, "en");
  }

  const [row] = await db
    .insert(schema.accessGrants)
    .values({
      userId: input.userId,
      scope: input.scope,
      programId: input.scope === "program" ? input.programId! : null,
      courseId: input.scope === "course" ? input.courseId! : null,
      expiresAt,
      reason: input.reason,
      grantedBy: actor.id,
    })
    .returning({ id: schema.accessGrants.id });
  await notify(
    input.userId,
    "accessGranted",
    { scope: scopeLabel, date: expiresAt ? expiresAt.toISOString().slice(0, 10) : "∞" },
    "/student/courses",
  );
  await audit({
    actorId: actor.id,
    action: "access.grant",
    entity: "access_grants",
    entityId: row!.id,
    after: { ...input },
  });
  return { id: row!.id };
}

export const extendGrantSchema = z.object({ grantId: z.string().uuid(), expiresAt: z.string().datetime().nullable() });

export async function extendGrant(actor: SessionUser, input: z.output<typeof extendGrantSchema>) {
  assertAdmin(actor);
  const db = getDb();
  const grant = await db.query.accessGrants.findFirst({ where: eq(schema.accessGrants.id, input.grantId) });
  if (!grant) throw notFound();
  if (grant.revokedAt) throw conflict("revoked");
  const expiresAt = parseFuture(input.expiresAt);
  await db.update(schema.accessGrants).set({ expiresAt }).where(eq(schema.accessGrants.id, grant.id));
  await notify(
    grant.userId,
    "accessGranted",
    { scope: grant.scope, date: expiresAt ? expiresAt.toISOString().slice(0, 10) : "∞" },
    "/student/courses",
  );
  await audit({
    actorId: actor.id,
    action: "access.extend",
    entity: "access_grants",
    entityId: grant.id,
    before: { expiresAt: grant.expiresAt },
    after: { expiresAt },
  });
  return { id: grant.id };
}

export async function revokeGrant(actor: SessionUser, grantId: string) {
  assertAdmin(actor);
  const [row] = await getDb()
    .update(schema.accessGrants)
    .set({ revokedAt: new Date() })
    .where(eq(schema.accessGrants.id, grantId))
    .returning({ id: schema.accessGrants.id, userId: schema.accessGrants.userId });
  if (!row) throw notFound();
  await audit({ actorId: actor.id, action: "access.revoke", entity: "access_grants", entityId: row.id, after: { userId: row.userId } });
  return { id: row.id };
}

export const extendSubscriptionSchema = z.object({ subscriptionId: z.string().uuid(), days: z.number().int().min(1).max(3650) });

/** Manual subscriptions only: pushes the period end by `days` (from the later of now and current end). */
export async function extendSubscription(actor: SessionUser, input: z.output<typeof extendSubscriptionSchema>) {
  assertAdmin(actor);
  const db = getDb();
  const sub = await db.query.subscriptions.findFirst({ where: eq(schema.subscriptions.id, input.subscriptionId) });
  if (!sub) throw notFound();
  if (sub.source !== "manual") throw conflict("not_manual");
  const now = new Date();
  const base = sub.currentPeriodEnd && sub.currentPeriodEnd > now && sub.status === "active" ? sub.currentPeriodEnd : now;
  const end = new Date(base.getTime() + input.days * 86_400_000);
  await db
    .update(schema.subscriptions)
    .set({ status: "active", currentPeriodEnd: end, currentPeriodStart: sub.currentPeriodStart ?? now, expiryReminderSentAt: null })
    .where(eq(schema.subscriptions.id, sub.id));
  const seats = await db
    .select({ userId: schema.subscriptionSeats.userId })
    .from(schema.subscriptionSeats)
    .where(eq(schema.subscriptionSeats.subscriptionId, sub.id));
  const ids = [...new Set([sub.payerId, ...seats.map((s) => s.userId)])];
  await notify(ids, "accessGranted", { scope: "subscription", date: end.toISOString().slice(0, 10) }, "/student/courses");
  await audit({
    actorId: actor.id,
    action: "subscription.extend",
    entity: "subscriptions",
    entityId: sub.id,
    before: { currentPeriodEnd: sub.currentPeriodEnd, status: sub.status },
    after: { currentPeriodEnd: end, days: input.days },
  });
  return { id: sub.id, periodEnd: end.toISOString() };
}

export async function cancelSubscription(actor: SessionUser, subscriptionId: string) {
  assertAdmin(actor);
  const db = getDb();
  const sub = await db.query.subscriptions.findFirst({ where: eq(schema.subscriptions.id, subscriptionId) });
  if (!sub) throw notFound();
  if (sub.source !== "manual") throw conflict("not_manual");
  await db
    .update(schema.subscriptions)
    .set({ status: "cancelled", cancelAtPeriodEnd: false })
    .where(and(eq(schema.subscriptions.id, sub.id), inArray(schema.subscriptions.status, ["active", "past_due", "pending"])));
  await audit({
    actorId: actor.id,
    action: "subscription.cancel",
    entity: "subscriptions",
    entityId: sub.id,
    before: { status: sub.status },
    after: { status: "cancelled" },
  });
  return { id: sub.id };
}

/** Options for the program/course pickers in the grant dialog. */
export async function accessTargets(actor: SessionUser) {
  assertAdmin(actor);
  const db = getDb();
  const [programs, courses] = await Promise.all([
    db.select({ id: schema.programs.id, name: schema.programs.name }).from(schema.programs).orderBy(schema.programs.sortOrder),
    db
      .select({ id: schema.courses.id, title: schema.courses.title, programId: schema.courses.programId })
      .from(schema.courses)
      .orderBy(schema.courses.sortOrder),
  ]);
  return {
    programs: programs.map((p) => ({ id: p.id, name: t18n(p.name, actor.locale) })),
    courses: courses.map((c) => ({ id: c.id, name: t18n(c.title, actor.locale), programId: c.programId })),
  };
}
