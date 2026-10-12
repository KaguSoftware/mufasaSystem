import "server-only";
import { headers } from "next/headers";
import { z } from "zod";
import { and, desc, eq, getDb, inArray, isNull, schema } from "@mufasa/db";
import { isPlausibleBirthYear } from "@/lib/minor";
import { POLICY_VERSION } from "@/lib/policy";
import { getAuth } from "../auth";
import { AppError, forbidden, notFound } from "../errors";
import { isParentOf, type SessionUser } from "../session";

export const consentSchema = z.object({
  allowLiveVideo: z.boolean(),
  allowRecitationRecording: z.boolean(),
  allowAiFeedback: z.boolean(),
  allowSessionRecording: z.boolean(),
});
export type ConsentInput = z.infer<typeof consentSchema>;

export const USERNAME_RE = /^[a-z0-9_.]{3,30}$/;
export const PIN_RE = /^\d{6}$/;

export const createChildSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  birthYear: z.number().int(),
  username: z.string().trim().toLowerCase().regex(USERNAME_RE),
  pin: z.string().regex(PIN_RE),
  consent: consentSchema,
});
export type CreateChildInput = z.infer<typeof createChildSchema>;

export type ChildSummary = {
  id: string;
  displayName: string;
  birthYear: number | null;
  username: string | null;
  consent: (ConsentInput & { acceptedAt: Date; policyVersion: string }) | null;
};

function requireParent(actor: SessionUser) {
  if (actor.role !== "parent") throw forbidden();
}

async function assertGuardian(actor: SessionUser, childId: string) {
  requireParent(actor);
  if (!(await isParentOf(actor.id, childId))) throw forbidden();
}

async function requestMeta() {
  try {
    const h = await headers();
    return {
      ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

/**
 * Create a managed child account for `actor` (a parent) WITHOUT touching the parent's session.
 * Uses Better Auth's internal adapter (user + credential account with hashed PIN), then
 * writes the app tables in one transaction. If the app-table writes fail the user is removed.
 */
export async function createChild(actor: SessionUser, input: CreateChildInput): Promise<{ id: string }> {
  requireParent(actor);
  const data = createChildSchema.parse(input);
  if (!isPlausibleBirthYear(data.birthYear)) {
    throw new AppError("validation", "birthYear", { birthYear: ["invalid"] });
  }
  const db = getDb();

  const taken = await db.query.user.findFirst({
    where: eq(schema.user.username, data.username),
    columns: { id: true },
  });
  if (taken) throw new AppError("conflict", "username_taken", { username: ["taken"] });

  const ctx = await getAuth().$context;
  const meta = await requestMeta();
  const childId = crypto.randomUUID();
  const created = await ctx.internalAdapter.createUser({
    id: childId,
    name: data.displayName,
    email: `${childId}@kids.invalid`,
    emailVerified: true,
    username: data.username,
    displayUsername: data.username,
    role: "student",
    isManagedChild: true,
    locale: actor.locale,
    timezone: actor.timezone,
  }, { method: "admin" });
  const userId = created.id;

  try {
    const hash = await ctx.password.hash(data.pin);
    await ctx.internalAdapter.linkAccount({
      userId,
      providerId: "credential",
      accountId: userId,
      password: hash,
    });
    await db.transaction(async (tx) => {
      await tx.insert(schema.parentChildren).values({ parentId: actor.id, childId: userId, relation: "parent" });
      await tx.insert(schema.profiles).values({
        userId,
        displayName: data.displayName,
        birthYear: data.birthYear,
      });
      await tx.insert(schema.parentalConsents).values({
        parentId: actor.id,
        childId: userId,
        policyVersion: POLICY_VERSION,
        ...data.consent,
        ...meta,
      });
    });
  } catch (err) {
    await ctx.internalAdapter.deleteUser(userId).catch(() => undefined);
    throw err;
  }
  return { id: userId };
}

export async function getActiveConsent(childId: string) {
  const row = await getDb().query.parentalConsents.findFirst({
    where: and(eq(schema.parentalConsents.childId, childId), isNull(schema.parentalConsents.revokedAt)),
    orderBy: desc(schema.parentalConsents.acceptedAt),
  });
  return row ?? null;
}

/** Convenience for other modules: is `feature` allowed for this child? Adults/unmanaged students return true. */
export async function childAllows(
  childId: string,
  feature: "allowLiveVideo" | "allowRecitationRecording" | "allowAiFeedback" | "allowSessionRecording",
): Promise<boolean> {
  const u = await getDb().query.user.findFirst({
    where: eq(schema.user.id, childId),
    columns: { isManagedChild: true, role: true },
    with: { profile: { columns: { birthYear: true } } },
  });
  if (!u?.isManagedChild) {
    // Unknown age for a self-registered student is treated as a minor without consent.
    if (u && u.role === "student" && !u.profile?.birthYear) return false;
    return true;
  }
  const c = await getActiveConsent(childId);
  return Boolean(c?.[feature]);
}

export async function listChildren(actor: SessionUser): Promise<ChildSummary[]> {
  requireParent(actor);
  const db = getDb();
  const links = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      username: schema.user.username,
      displayName: schema.profiles.displayName,
      birthYear: schema.profiles.birthYear,
    })
    .from(schema.parentChildren)
    .innerJoin(schema.user, eq(schema.user.id, schema.parentChildren.childId))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.user.id))
    .where(eq(schema.parentChildren.parentId, actor.id))
    .orderBy(schema.parentChildren.createdAt);
  if (!links.length) return [];
  const consents = await db
    .select()
    .from(schema.parentalConsents)
    .where(and(inArray(schema.parentalConsents.childId, links.map((l) => l.id)), isNull(schema.parentalConsents.revokedAt)))
    .orderBy(desc(schema.parentalConsents.acceptedAt));
  const latest = new Map<string, (typeof consents)[number]>();
  for (const c of consents) if (!latest.has(c.childId)) latest.set(c.childId, c);
  return links.map((l) => {
    const c = latest.get(l.id);
    return {
      id: l.id,
      displayName: l.displayName ?? l.name,
      birthYear: l.birthYear ?? null,
      username: l.username ?? null,
      consent: c
        ? {
            allowLiveVideo: c.allowLiveVideo,
            allowRecitationRecording: c.allowRecitationRecording,
            allowAiFeedback: c.allowAiFeedback,
            allowSessionRecording: c.allowSessionRecording,
            acceptedAt: c.acceptedAt,
            policyVersion: c.policyVersion,
          }
        : null,
    };
  });
}

export const updateChildSchema = z.object({
  childId: z.string().min(1),
  displayName: z.string().trim().min(1).max(40),
  birthYear: z.number().int(),
});

export async function updateChild(actor: SessionUser, input: z.infer<typeof updateChildSchema>): Promise<void> {
  const data = updateChildSchema.parse(input);
  await assertGuardian(actor, data.childId);
  if (!isPlausibleBirthYear(data.birthYear)) throw new AppError("validation", "birthYear", { birthYear: ["invalid"] });
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(schema.profiles)
      .set({ displayName: data.displayName, birthYear: data.birthYear })
      .where(eq(schema.profiles.userId, data.childId));
    await tx.update(schema.user).set({ name: data.displayName }).where(eq(schema.user.id, data.childId));
  });
}

export async function resetChildPin(actor: SessionUser, childId: string, pin: string): Promise<void> {
  await assertGuardian(actor, childId);
  if (!PIN_RE.test(pin)) throw new AppError("validation", "pin", { pin: ["invalid"] });
  const child = await getDb().query.user.findFirst({
    where: eq(schema.user.id, childId),
    columns: { isManagedChild: true },
  });
  if (!child) throw notFound();
  if (!child.isManagedChild) throw forbidden();
  const ctx = await getAuth().$context;
  await ctx.internalAdapter.updatePassword(childId, await ctx.password.hash(pin));
  // Sign the child out everywhere so the old PIN stops working immediately.
  await ctx.internalAdapter.deleteUserSessions(childId);
}

/** Records a new consent row (with current policy version, IP, UA) and revokes the previous active one. */
export async function updateConsent(actor: SessionUser, childId: string, consent: ConsentInput): Promise<void> {
  await assertGuardian(actor, childId);
  const parsed = consentSchema.parse(consent);
  const meta = await requestMeta();
  await getDb().transaction(async (tx) => {
    await tx
      .update(schema.parentalConsents)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.parentalConsents.childId, childId), isNull(schema.parentalConsents.revokedAt)));
    await tx.insert(schema.parentalConsents).values({
      parentId: actor.id,
      childId,
      policyVersion: POLICY_VERSION,
      ...parsed,
      ...meta,
    });
  });
}
