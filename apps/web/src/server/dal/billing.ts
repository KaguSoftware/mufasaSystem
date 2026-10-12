import "server-only";
import { z } from "zod";
import { and, asc, desc, eq, getDb, gt, inArray, isDbConfigured, schema, sql } from "@mufasa/db";
import { t18n } from "@mufasa/config/locales";
import {
  applyCoupon,
  generateReferenceCode,
  periodEnd,
  REFERENCE_PATTERN,
  summarizeAccess,
} from "@/lib/billing-math";
import { audit } from "../audit";
import { activeGrantsFor, activeSeatsFor } from "../access";
import { AppError, conflict, forbidden, notFound } from "../errors";
import { notify } from "../notify";
import { childrenOf, isParentOf, type SessionUser } from "../session";
import { objectPath, storage } from "../storage";

type PlanRow = typeof schema.plans.$inferSelect;
type CouponRow = typeof schema.coupons.$inferSelect;

const i18nShort = z.object({
  en: z.string().trim().min(1).max(200),
  ar: z.string().trim().max(200).optional(),
  tr: z.string().trim().max(200).optional(),
});
const i18nLong = z.object({
  en: z.string().trim().max(1000),
  ar: z.string().trim().max(1000).optional(),
  tr: z.string().trim().max(1000).optional(),
});

function assertAdmin(actor: SessionUser) {
  if (actor.role !== "admin") throw forbidden();
}

const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
const isUniqueViolation = (e: unknown) => /unique|23505/i.test(String((e as Error)?.message) + String((e as { code?: string })?.code));

// ───────────────────────────── Plans ─────────────────────────────

export const planInputSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
  name: i18nShort,
  description: i18nLong.nullish(),
  priceMinor: z.number().int().min(0).max(100_000_000),
  currency: z.enum(["TRY", "USD", "EUR"]),
  interval: z.enum(["month", "quarter", "year", "one_time"]),
  periodDays: z.number().int().min(1).max(3650),
  programIds: z.array(z.string().uuid()).max(100),
  seats: z.number().int().min(1).max(20),
  liveClassesPerMonth: z.number().int().min(0).max(100).default(0),
  features: z.array(z.string().trim().min(1).max(200)).max(30),
  iyzicoPricingPlanRef: z.string().trim().max(120).nullish(),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});
export type PlanInput = z.input<typeof planInputSchema>;

/** Public: plans shown on pricing and billing screens. Works without a DB (returns []). */
export async function listActivePlans(): Promise<PlanRow[]> {
  if (!isDbConfigured()) return [];
  return getDb()
    .select()
    .from(schema.plans)
    .where(eq(schema.plans.active, true))
    .orderBy(asc(schema.plans.sortOrder), asc(schema.plans.priceMinor));
}

export async function listAllPlans(actor: SessionUser): Promise<PlanRow[]> {
  assertAdmin(actor);
  return getDb().select().from(schema.plans).orderBy(asc(schema.plans.sortOrder), asc(schema.plans.priceMinor));
}

export async function upsertPlan(actor: SessionUser, input: z.output<typeof planInputSchema>) {
  assertAdmin(actor);
  const db = getDb();
  const { id, ...values } = input;
  const data = { ...values, description: values.description ?? null, iyzicoPricingPlanRef: values.iyzicoPricingPlanRef || null };
  try {
    if (id) {
      const before = await db.query.plans.findFirst({ where: eq(schema.plans.id, id) });
      if (!before) throw notFound();
      await db.update(schema.plans).set(data).where(eq(schema.plans.id, id));
      await audit({ actorId: actor.id, action: "plan.update", entity: "plans", entityId: id, before, after: data });
      return { id };
    }
    const [row] = await db.insert(schema.plans).values(data).returning({ id: schema.plans.id });
    await audit({ actorId: actor.id, action: "plan.create", entity: "plans", entityId: row!.id, after: data });
    return { id: row!.id };
  } catch (e) {
    if (!(e instanceof AppError) && isUniqueViolation(e)) throw new AppError("conflict", "slug", { slug: ["taken"] });
    throw e;
  }
}

// ───────────────────────────── Coupons ─────────────────────────────

export const couponInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3)
      .max(40)
      .regex(/^[A-Z0-9_-]+$/),
    percentOff: z.number().int().min(1).max(100).nullish(),
    amountOffMinor: z.number().int().min(1).max(100_000_000).nullish(),
    currency: z.enum(["TRY", "USD", "EUR"]).nullish(),
    maxRedemptions: z.number().int().min(1).nullish(),
    planIds: z.array(z.string().uuid()).max(100),
    validFrom: z.string().datetime().nullish(),
    validUntil: z.string().datetime().nullish(),
    active: z.boolean(),
  })
  .refine((c) => Boolean(c.percentOff) !== Boolean(c.amountOffMinor), { message: "percent_or_amount", path: ["percentOff"] })
  .refine((c) => !c.amountOffMinor || c.currency, { message: "currency_required", path: ["currency"] });

export async function listCoupons(actor: SessionUser): Promise<CouponRow[]> {
  assertAdmin(actor);
  return getDb().select().from(schema.coupons).orderBy(desc(schema.coupons.createdAt));
}

export async function upsertCoupon(actor: SessionUser, input: z.output<typeof couponInputSchema>) {
  assertAdmin(actor);
  const db = getDb();
  const { id, ...rest } = input;
  const data = {
    code: rest.code,
    percentOff: rest.percentOff ?? null,
    amountOffMinor: rest.amountOffMinor ?? null,
    currency: rest.amountOffMinor ? (rest.currency ?? null) : null,
    maxRedemptions: rest.maxRedemptions ?? null,
    planIds: rest.planIds,
    validFrom: rest.validFrom ? new Date(rest.validFrom) : null,
    validUntil: rest.validUntil ? new Date(rest.validUntil) : null,
    active: rest.active,
  };
  try {
    if (id) {
      await db.update(schema.coupons).set(data).where(eq(schema.coupons.id, id));
      await audit({ actorId: actor.id, action: "coupon.update", entity: "coupons", entityId: id, after: data });
      return { id };
    }
    const [row] = await db.insert(schema.coupons).values(data).returning({ id: schema.coupons.id });
    await audit({ actorId: actor.id, action: "coupon.create", entity: "coupons", entityId: row!.id, after: data });
    return { id: row!.id };
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("conflict", "code", { code: ["taken"] });
    throw e;
  }
}

export async function deleteCoupon(actor: SessionUser, id: string) {
  assertAdmin(actor);
  await getDb().delete(schema.coupons).where(eq(schema.coupons.id, id));
  await audit({ actorId: actor.id, action: "coupon.delete", entity: "coupons", entityId: id });
}

/** Throws validation(couponCode) when the coupon cannot be used for this plan right now. */
export async function validateCoupon(code: string, planId: string, now = new Date()): Promise<CouponRow> {
  const db = getDb();
  const coupon = await db.query.coupons.findFirst({ where: eq(schema.coupons.code, code.trim().toUpperCase()) });
  const bad = () => new AppError("validation", "coupon", { couponCode: ["invalid"] });
  if (!coupon || !coupon.active) throw bad();
  if (coupon.validFrom && coupon.validFrom > now) throw bad();
  if (coupon.validUntil && coupon.validUntil < now) throw bad();
  if (coupon.maxRedemptions != null && coupon.redemptions >= coupon.maxRedemptions) throw bad();
  if (coupon.planIds.length && !coupon.planIds.includes(planId)) throw bad();
  const plan = await db.query.plans.findFirst({ where: eq(schema.plans.id, planId), columns: { currency: true } });
  if (coupon.amountOffMinor && coupon.currency && plan && coupon.currency !== plan.currency) throw bad();
  return coupon;
}

// ───────────────────────────── Receipts ─────────────────────────────

const RECEIPT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

/** Validates and stores a receipt in the private `receipts` bucket. Returns the object path. */
export async function uploadReceipt(actor: SessionUser, file: File): Promise<{ path: string }> {
  const ext = RECEIPT_TYPES[file.type];
  if (!ext) throw new AppError("validation", "type", { file: ["type"] });
  if (file.size <= 0 || file.size > RECEIPT_MAX_BYTES) throw new AppError("validation", "size", { file: ["size"] });
  const store = storage(); // throws integration_not_configured when Supabase is missing
  const path = objectPath(`receipts/${actor.id}`, ext);
  await store.upload("receipts", path, new Uint8Array(await file.arrayBuffer()), file.type);
  return { path };
}

// ───────────────────────────── Manual (IBAN / WhatsApp) requests ─────────────────────────────

export const quoteInputSchema = z.object({
  planId: z.string().uuid(),
  learnerIds: z.array(z.string().min(1)).min(1).max(20),
  couponCode: z.string().trim().max(40).optional(),
});

export const manualRequestInputSchema = quoteInputSchema.extend({
  reference: z.string().regex(REFERENCE_PATTERN).optional(),
  receiptPath: z.string().max(300).optional(),
  senderName: z.string().trim().max(120).optional(),
  note: z.string().trim().max(1000).optional(),
});

/** Learners must be the actor or the actor's children; managed child accounts cannot pay. */
export async function resolveLearners(actor: SessionUser, learnerIds: string[]): Promise<string[]> {
  if (actor.isManagedChild || (actor.role !== "parent" && actor.role !== "student")) throw forbidden();
  const unique = [...new Set(learnerIds)];
  for (const id of unique) {
    if (id === actor.id) {
      if (actor.role !== "student") throw forbidden(); // parents do not take courses themselves
      continue;
    }
    if (!(await isParentOf(actor.id, id))) throw forbidden();
  }
  return unique;
}

export async function loadPayablePlan(planId: string, learnerCount: number): Promise<PlanRow> {
  const plan = await getDb().query.plans.findFirst({ where: eq(schema.plans.id, planId) });
  if (!plan || !plan.active) throw notFound();
  if (learnerCount > plan.seats) throw new AppError("validation", "seats", { learnerIds: ["too_many"] });
  return plan;
}

export async function quoteManualPayment(actor: SessionUser, input: z.output<typeof quoteInputSchema>) {
  const learners = await resolveLearners(actor, input.learnerIds);
  const plan = await loadPayablePlan(input.planId, learners.length);
  const coupon = input.couponCode ? await validateCoupon(input.couponCode, plan.id) : null;
  const { discountMinor, totalMinor } = applyCoupon(plan.priceMinor, coupon);
  return {
    amountMinor: totalMinor,
    discountMinor,
    priceMinor: plan.priceMinor,
    currency: plan.currency,
    couponCode: coupon?.code ?? null,
  };
}

export async function createManualPaymentRequest(actor: SessionUser, input: z.output<typeof manualRequestInputSchema>) {
  const learners = await resolveLearners(actor, input.learnerIds);
  const plan = await loadPayablePlan(input.planId, learners.length);
  const coupon = input.couponCode ? await validateCoupon(input.couponCode, plan.id) : null;
  const { totalMinor } = applyCoupon(plan.priceMinor, coupon);
  if (input.receiptPath && !input.receiptPath.startsWith(`receipts/${actor.id}/`)) throw forbidden();

  const db = getDb();
  const pending = await db
    .select({ id: schema.manualPaymentRequests.id })
    .from(schema.manualPaymentRequests)
    .where(and(eq(schema.manualPaymentRequests.payerId, actor.id), eq(schema.manualPaymentRequests.status, "pending")));
  if (pending.length >= 5) throw conflict("too_many_pending");

  const reference = input.reference ?? generateReferenceCode();
  const [row] = await db
    .insert(schema.manualPaymentRequests)
    .values({
      payerId: actor.id,
      planId: plan.id,
      learnerIds: learners,
      amountMinor: totalMinor,
      currency: plan.currency,
      receiptPath: input.receiptPath ?? null,
      senderName: input.senderName || null,
      referenceCode: reference,
      couponId: coupon?.id ?? null,
      note: input.note || null,
    })
    .returning({ id: schema.manualPaymentRequests.id });
  return { id: row!.id, reference, amountMinor: totalMinor, currency: plan.currency };
}

export type PaymentRequestView = {
  id: string;
  status: "pending" | "approved" | "rejected";
  payer: { id: string; name: string; email: string };
  plan: { id: string; name: string; periodDays: number };
  learners: { id: string; name: string }[];
  amountMinor: number;
  currency: string;
  reference: string | null;
  couponCode: string | null;
  senderName: string | null;
  note: string;
  hasReceipt: boolean;
  reviewNote: string | null;
  createdAt: string;
};

export async function listPaymentRequests(
  actor: SessionUser,
  status: "pending" | "approved" | "rejected",
): Promise<PaymentRequestView[]> {
  assertAdmin(actor);
  const db = getDb();
  const rows = await db
    .select({ r: schema.manualPaymentRequests, payer: schema.user, plan: schema.plans })
    .from(schema.manualPaymentRequests)
    .innerJoin(schema.user, eq(schema.user.id, schema.manualPaymentRequests.payerId))
    .innerJoin(schema.plans, eq(schema.plans.id, schema.manualPaymentRequests.planId))
    .where(eq(schema.manualPaymentRequests.status, status))
    .orderBy(desc(schema.manualPaymentRequests.createdAt))
    .limit(200);
  const learnerIds = [...new Set(rows.flatMap((x) => x.r.learnerIds))];
  const learners = learnerIds.length
    ? await db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(inArray(schema.user.id, learnerIds))
    : [];
  const nameOf = new Map(learners.map((l) => [l.id, l.name]));
  const couponIds = [...new Set(rows.map((x) => x.r.couponId).filter((v): v is string => Boolean(v)))];
  const couponCodes = new Map(
    couponIds.length
      ? (await db.select({ id: schema.coupons.id, code: schema.coupons.code }).from(schema.coupons).where(inArray(schema.coupons.id, couponIds))).map((c) => [c.id, c.code] as const)
      : [],
  );
  return rows.map(({ r, payer, plan }) => {
    return {
      id: r.id,
      status: r.status,
      payer: { id: payer.id, name: payer.name, email: payer.email },
      plan: { id: plan.id, name: t18n(plan.name, actor.locale), periodDays: plan.periodDays },
      learners: r.learnerIds.map((id) => ({ id, name: nameOf.get(id) ?? id })),
      amountMinor: r.amountMinor,
      currency: r.currency,
      reference: r.referenceCode,
      couponCode: couponCodes.get(r.couponId ?? "") ?? null,
      senderName: r.senderName,
      note: r.note ?? "",
      hasReceipt: Boolean(r.receiptPath),
      reviewNote: r.reviewNote,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

/** Admin only: short-lived signed URL for a receipt. */
export async function getReceiptUrl(actor: SessionUser, requestId: string): Promise<{ url: string }> {
  assertAdmin(actor);
  const row = await getDb().query.manualPaymentRequests.findFirst({
    where: eq(schema.manualPaymentRequests.id, requestId),
    columns: { receiptPath: true },
  });
  if (!row?.receiptPath) throw notFound();
  return { url: await storage().signedUrl("receipts", row.receiptPath, 300) };
}

export const approveInputSchema = z.object({
  id: z.string().uuid(),
  periodDays: z.number().int().min(1).max(3650).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function approvePaymentRequest(actor: SessionUser, input: z.output<typeof approveInputSchema>) {
  assertAdmin(actor);
  const db = getDb();
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const [req] = await tx
      .select()
      .from(schema.manualPaymentRequests)
      .where(eq(schema.manualPaymentRequests.id, input.id))
      .for("update");
    if (!req) throw notFound();
    if (req.status !== "pending") throw conflict("already_reviewed");
    const plan = await tx.query.plans.findFirst({ where: eq(schema.plans.id, req.planId) });
    if (!plan) throw notFound();

    // Renewal: start when the learners' current manual subscription to the same plan ends.
    let start = now;
    if (req.learnerIds.length) {
      const current = await tx
        .select({ end: sql<string | null>`max(${schema.subscriptions.currentPeriodEnd})` })
        .from(schema.subscriptionSeats)
        .innerJoin(schema.subscriptions, eq(schema.subscriptions.id, schema.subscriptionSeats.subscriptionId))
        .where(
          and(
            inArray(schema.subscriptionSeats.userId, req.learnerIds),
            eq(schema.subscriptions.planId, plan.id),
            eq(schema.subscriptions.source, "manual"),
            eq(schema.subscriptions.status, "active"),
            gt(schema.subscriptions.currentPeriodEnd, now),
          ),
        );
      const existing = current[0]?.end ? new Date(current[0].end) : null;
      if (existing && existing > now) start = existing;
    }
    const end = periodEnd(start, plan, input.periodDays);

    // Count the coupon redemption now (the cap was checked at request time; re-check under lock).
    const couponId = req.couponId;
    if (couponId) {
      const [c] = await tx.select().from(schema.coupons).where(eq(schema.coupons.id, couponId)).for("update");
      if (c?.maxRedemptions != null && c.redemptions >= c.maxRedemptions) throw conflict("coupon_exhausted");
      await tx
        .update(schema.coupons)
        .set({ redemptions: sql`${schema.coupons.redemptions} + 1` })
        .where(eq(schema.coupons.id, couponId));
    }

    const [sub] = await tx
      .insert(schema.subscriptions)
      .values({
        payerId: req.payerId,
        planId: plan.id,
        source: "manual",
        status: "active",
        currentPeriodStart: start,
        currentPeriodEnd: end,
        couponId,
      })
      .returning({ id: schema.subscriptions.id });
    if (req.learnerIds.length) {
      await tx.insert(schema.subscriptionSeats).values(req.learnerIds.map((userId) => ({ subscriptionId: sub!.id, userId })));
    }
    await tx.insert(schema.payments).values({
      payerId: req.payerId,
      subscriptionId: sub!.id,
      provider: "manual",
      providerRef: req.referenceCode,
      amountMinor: req.amountMinor,
      currency: req.currency,
      status: "succeeded",
      paidAt: now,
      raw: { requestId: req.id },
    });
    await tx
      .update(schema.manualPaymentRequests)
      .set({ status: "approved", reviewedBy: actor.id, reviewedAt: now, reviewNote: input.note ?? null, subscriptionId: sub!.id })
      .where(eq(schema.manualPaymentRequests.id, req.id));
    return { req, plan, subscriptionId: sub!.id, end };
  });

  const { req, plan, subscriptionId, end } = result;
  const payer = await db.query.user.findFirst({ where: eq(schema.user.id, req.payerId), columns: { role: true } });
  await notify(req.payerId, "paymentApproved", {}, `/${payer?.role === "student" ? "student" : "parent"}/billing`);
  await notify(req.learnerIds, "accessGranted", { scope: t18n(plan.name, "en"), date: dateOnly(end) }, "/student/courses");
  await audit({
    actorId: actor.id,
    action: "payment.approve",
    entity: "manual_payment_requests",
    entityId: req.id,
    after: { subscriptionId, periodEnd: end.toISOString(), periodDays: input.periodDays ?? plan.periodDays },
  });
  return { subscriptionId, periodEnd: end.toISOString() };
}

export const rejectInputSchema = z.object({ id: z.string().uuid(), reason: z.string().trim().min(2).max(500) });

export async function rejectPaymentRequest(actor: SessionUser, input: z.output<typeof rejectInputSchema>) {
  assertAdmin(actor);
  const db = getDb();
  const [req] = await db
    .update(schema.manualPaymentRequests)
    .set({ status: "rejected", reviewedBy: actor.id, reviewedAt: new Date(), reviewNote: input.reason })
    .where(and(eq(schema.manualPaymentRequests.id, input.id), eq(schema.manualPaymentRequests.status, "pending")))
    .returning();
  if (!req) throw conflict("already_reviewed");
  const payer = await db.query.user.findFirst({ where: eq(schema.user.id, req.payerId), columns: { role: true } });
  await notify(req.payerId, "paymentRejected", {}, `/${payer?.role === "student" ? "student" : "parent"}/billing`);
  await audit({ actorId: actor.id, action: "payment.reject", entity: "manual_payment_requests", entityId: req.id, after: { reason: input.reason } });
  return { id: req.id };
}

// ───────────────────────────── Parent / student view ─────────────────────────────

export type LearnerBilling = {
  id: string;
  name: string;
  isSelf: boolean;
  access: { active: boolean; forever: boolean; until: string | null };
  subscriptions: {
    id: string;
    planName: string;
    source: "iyzico" | "manual";
    status: string;
    periodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  }[];
};

export type MyBilling = {
  learners: LearnerBilling[];
  requests: {
    id: string;
    status: "pending" | "approved" | "rejected";
    planName: string;
    amountMinor: number;
    currency: string;
    reference: string | null;
    learnerNames: string[];
    reviewNote: string | null;
    createdAt: string;
  }[];
};

export async function myBilling(actor: SessionUser): Promise<MyBilling> {
  const db = getDb();
  const ids = actor.role === "parent" ? await childrenOf(actor.id) : [actor.id];
  const people = ids.length
    ? await db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(inArray(schema.user.id, ids))
    : [];

  const learners: LearnerBilling[] = await Promise.all(
    people.map(async (p) => {
      const [grants, seats, subs] = await Promise.all([
        activeGrantsFor(p.id),
        activeSeatsFor(p.id),
        db
          .select({ s: schema.subscriptions, plan: schema.plans })
          .from(schema.subscriptionSeats)
          .innerJoin(schema.subscriptions, eq(schema.subscriptions.id, schema.subscriptionSeats.subscriptionId))
          .innerJoin(schema.plans, eq(schema.plans.id, schema.subscriptions.planId))
          .where(
            and(
              eq(schema.subscriptionSeats.userId, p.id),
              inArray(schema.subscriptions.status, ["active", "past_due", "pending"]),
            ),
          )
          .orderBy(desc(schema.subscriptions.currentPeriodEnd)),
      ]);
      const sum = summarizeAccess(grants, seats);
      return {
        id: p.id,
        name: p.name,
        isSelf: p.id === actor.id,
        access: { active: sum.active, forever: sum.forever, until: sum.until?.toISOString() ?? null },
        subscriptions: subs.map(({ s, plan }) => ({
          id: s.id,
          planName: t18n(plan.name, actor.locale),
          source: s.source,
          status: s.status,
          periodEnd: s.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        })),
      };
    }),
  );

  const reqs = await db
    .select({ r: schema.manualPaymentRequests, plan: schema.plans })
    .from(schema.manualPaymentRequests)
    .innerJoin(schema.plans, eq(schema.plans.id, schema.manualPaymentRequests.planId))
    .where(eq(schema.manualPaymentRequests.payerId, actor.id))
    .orderBy(desc(schema.manualPaymentRequests.createdAt))
    .limit(10);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  return {
    learners,
    requests: reqs.map(({ r, plan }) => ({
      id: r.id,
      status: r.status,
      planName: t18n(plan.name, actor.locale),
      amountMinor: r.amountMinor,
      currency: r.currency,
      reference: r.referenceCode,
      learnerNames: r.learnerIds.map((id) => nameOf.get(id) ?? "").filter(Boolean),
      reviewNote: r.reviewNote,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
