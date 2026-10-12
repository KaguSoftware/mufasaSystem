import "server-only";
import { z } from "zod";
import { and, desc, eq, getDb, schema } from "@mufasa/db";
import { t18n } from "@mufasa/config/locales";
import { periodEnd } from "@/lib/billing-math";
import { env } from "@/env";
import { AppError, notFound } from "../errors";
import { notify } from "../notify";
import { audit } from "../audit";
import type { SessionUser } from "../session";
import { initSubscriptionCheckout, retrieveCheckout, type IyzicoWebhookPayload } from "../services/iyzico";
import { loadPayablePlan, resolveLearners } from "./billing";

export const cardCheckoutInputSchema = z.object({
  planId: z.string().uuid(),
  learnerIds: z.array(z.string().min(1)).min(1).max(20),
  identityNumber: z.string().trim().regex(/^\d{11}$/),
  gsmNumber: z.string().trim().max(20).optional(),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().max(60).optional(),
});

/** Creates a pending iyzico subscription + seats and returns the hosted checkout form. */
export async function startCardCheckout(actor: SessionUser, input: z.output<typeof cardCheckoutInputSchema>) {
  const learners = await resolveLearners(actor, input.learnerIds);
  const plan = await loadPayablePlan(input.planId, learners.length);
  if (!plan.iyzicoPricingPlanRef) throw new AppError("integration_not_configured", "iyzico plan");
  const db = getDb();

  const [sub] = await db
    .insert(schema.subscriptions)
    .values({ payerId: actor.id, planId: plan.id, source: "iyzico", status: "pending" })
    .returning({ id: schema.subscriptions.id });
  await db.insert(schema.subscriptionSeats).values(learners.map((userId) => ({ subscriptionId: sub!.id, userId })));

  const [first, ...rest] = actor.name.trim().split(/\s+/);
  const callbackUrl = `${env().APP_URL}/api/billing/iyzico/callback?sub=${sub!.id}&locale=${encodeURIComponent(actor.locale)}`;
  const form = await initSubscriptionCheckout({
    pricingPlanRef: plan.iyzicoPricingPlanRef,
    callbackUrl,
    conversationId: sub!.id,
    locale: actor.locale === "tr" ? "tr" : "en",
    payer: {
      name: first || actor.name,
      surname: rest.join(" ") || first || actor.name,
      email: actor.email,
      identityNumber: input.identityNumber,
      gsmNumber: input.gsmNumber,
      address: input.address,
      city: input.city,
    },
  });
  return { subscriptionId: sub!.id, checkoutFormContent: form.checkoutFormContent };
}

export type CallbackOutcome = { status: "success" | "failed" | "pending"; role: "parent" | "student"; subscriptionId: string | null };

/** Handles iyzico's checkout redirect: verifies the token with iyzico and activates the pending subscription. */
export async function finalizeCheckout(subscriptionId: string, token: string): Promise<CallbackOutcome> {
  const db = getDb();
  const sub = await db.query.subscriptions.findFirst({ where: eq(schema.subscriptions.id, subscriptionId) });
  if (!sub || sub.source !== "iyzico") throw notFound();
  const payer = await db.query.user.findFirst({ where: eq(schema.user.id, sub.payerId), columns: { role: true } });
  const role = payer?.role === "student" ? "student" : "parent";
  if (sub.status === "active") return { status: "success", role, subscriptionId: sub.id };
  if (sub.status !== "pending") return { status: "failed", role, subscriptionId: sub.id };

  const plan = await db.query.plans.findFirst({ where: eq(schema.plans.id, sub.planId) });
  if (!plan) throw notFound();
  const res = await retrieveCheckout(token);
  const matches =
    res.ok &&
    res.pricingPlanRef === plan.iyzicoPricingPlanRef &&
    (!res.conversationId || res.conversationId === sub.id);
  if (!matches) return { status: "failed", role, subscriptionId: sub.id };
  if (res.subscriptionStatus !== "ACTIVE") return { status: "pending", role, subscriptionId: sub.id };

  const start = new Date();
  const end = periodEnd(start, plan);
  const [updated] = await db
    .update(schema.subscriptions)
    .set({
      status: "active",
      iyzicoSubscriptionRef: res.subscriptionRef,
      iyzicoCustomerRef: res.customerRef,
      currentPeriodStart: start,
      currentPeriodEnd: end,
    })
    .where(and(eq(schema.subscriptions.id, sub.id), eq(schema.subscriptions.status, "pending")))
    .returning({ id: schema.subscriptions.id });
  if (updated) {
    const seats = await db
      .select({ userId: schema.subscriptionSeats.userId })
      .from(schema.subscriptionSeats)
      .where(eq(schema.subscriptionSeats.subscriptionId, sub.id));
    await notify(
      [...new Set([sub.payerId, ...seats.map((s) => s.userId)])],
      "accessGranted",
      { scope: t18n(plan.name, "en"), date: end.toISOString().slice(0, 10) },
      "/student/courses",
    );
  }
  return { status: "success", role, subscriptionId: sub.id };
}

/**
 * Applies a verified webhook event. Idempotent: payments are keyed by
 * (provider "iyzico", providerRef = orderReferenceCode), so redeliveries are no-ops.
 */
export async function applyWebhookEvent(p: IyzicoWebhookPayload): Promise<{ handled: boolean; reason?: string }> {
  const type = p.iyziEventType ?? "";
  if (!p.subscriptionReferenceCode) return { handled: false, reason: "no_subscription_ref" };
  const db = getDb();
  const sub = await db.query.subscriptions.findFirst({
    where: eq(schema.subscriptions.iyzicoSubscriptionRef, p.subscriptionReferenceCode),
  });
  if (!sub) return { handled: false, reason: "unknown_subscription" };
  const plan = await db.query.plans.findFirst({ where: eq(schema.plans.id, sub.planId) });
  if (!plan) return { handled: false, reason: "unknown_plan" };
  const orderRef = p.orderReferenceCode ?? p.iyziReferenceCode ?? null;
  const raw = p as unknown as Record<string, unknown>;

  const alreadyRecorded = async (status: "succeeded" | "failed") => {
    if (!orderRef) return false;
    const rows = await db
      .select({ id: schema.payments.id })
      .from(schema.payments)
      .where(and(eq(schema.payments.provider, "iyzico"), eq(schema.payments.providerRef, orderRef), eq(schema.payments.status, status)))
      .limit(1);
    return rows.length > 0;
  };

  if (type.includes("order.success")) {
    if (await alreadyRecorded("succeeded")) return { handled: true, reason: "duplicate" };
    const prior = await db
      .select({ id: schema.payments.id })
      .from(schema.payments)
      .where(and(eq(schema.payments.subscriptionId, sub.id), eq(schema.payments.status, "succeeded")))
      .orderBy(desc(schema.payments.createdAt))
      .limit(1);
    const now = new Date();
    // The first successful order is already covered by the period set in the checkout callback.
    const isFirst = prior.length === 0;
    const needsPeriod = !sub.currentPeriodEnd || sub.status === "pending";
    let start = sub.currentPeriodStart ?? now;
    let end = sub.currentPeriodEnd ?? periodEnd(now, plan);
    if (!isFirst || needsPeriod) {
      const base = sub.currentPeriodEnd && sub.currentPeriodEnd > now && !needsPeriod ? sub.currentPeriodEnd : now;
      start = base;
      end = periodEnd(base, plan);
    }
    await db.transaction(async (tx) => {
      await tx.insert(schema.payments).values({
        payerId: sub.payerId,
        subscriptionId: sub.id,
        provider: "iyzico",
        providerRef: orderRef,
        amountMinor: plan.priceMinor,
        currency: plan.currency,
        status: "succeeded",
        raw,
        paidAt: now,
      });
      await tx
        .update(schema.subscriptions)
        .set({ status: "active", currentPeriodStart: start, currentPeriodEnd: end, expiryReminderSentAt: null })
        .where(eq(schema.subscriptions.id, sub.id));
    });
    return { handled: true };
  }

  if (type.includes("order.failure")) {
    if (await alreadyRecorded("failed")) return { handled: true, reason: "duplicate" };
    await db.transaction(async (tx) => {
      await tx.insert(schema.payments).values({
        payerId: sub.payerId,
        subscriptionId: sub.id,
        provider: "iyzico",
        providerRef: orderRef,
        amountMinor: plan.priceMinor,
        currency: plan.currency,
        status: "failed",
        raw,
      });
      if (sub.status === "active") {
        await tx.update(schema.subscriptions).set({ status: "past_due" }).where(eq(schema.subscriptions.id, sub.id));
      }
    });
    await notify(sub.payerId, "paymentRejected", {}, "/parent/billing");
    return { handled: true };
  }

  if (/cancel/i.test(type)) {
    if (sub.status !== "cancelled") {
      await db.update(schema.subscriptions).set({ status: "cancelled" }).where(eq(schema.subscriptions.id, sub.id));
      await audit({ actorId: null, action: "subscription.cancel_webhook", entity: "subscriptions", entityId: sub.id, after: raw });
    }
    return { handled: true };
  }

  return { handled: false, reason: `ignored:${type}` };
}
