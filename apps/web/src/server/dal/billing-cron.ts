import "server-only";
import { and, eq, getDb, gt, gte, inArray, isNull, lt, lte, or, schema } from "@mufasa/db";
import { notify } from "../notify";
import { sendExpiryReminderEmail } from "../services/billing-emails";
import { getSetting } from "./settings";

const DAY = 86_400_000;
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Daily billing maintenance (called by /api/cron/billing):
 * 1. expire active/past_due subscriptions past currentPeriodEnd
 * 2. remind N days before the end (N = billing.reminderDaysBefore):
 *    - subscriptions: manual ones, or iyzico ones set to cancel at period end; deduped
 *      with subscriptions.expiryReminderSentAt (reset when a period is renewed)
 *    - grants: no dedupe column exists, so a grant is reminded only when its expiresAt falls
 *      on the UTC calendar day exactly N days from now. A daily cron therefore sends it once.
 */
export async function runBillingCron(now = new Date()) {
  const db = getDb();
  const days = await getSetting("billing.reminderDaysBefore");

  const expired = await db
    .update(schema.subscriptions)
    .set({ status: "expired" })
    .where(and(inArray(schema.subscriptions.status, ["active", "past_due"]), lt(schema.subscriptions.currentPeriodEnd, now)))
    .returning({ id: schema.subscriptions.id });

  // Subscription reminders
  const horizon = new Date(now.getTime() + days * DAY);
  const due = await db
    .select({ s: schema.subscriptions, payer: schema.user })
    .from(schema.subscriptions)
    .innerJoin(schema.user, eq(schema.user.id, schema.subscriptions.payerId))
    .where(
      and(
        eq(schema.subscriptions.status, "active"),
        gt(schema.subscriptions.currentPeriodEnd, now),
        lte(schema.subscriptions.currentPeriodEnd, horizon),
        or(isNull(schema.subscriptions.expiryReminderSentAt), lt(schema.subscriptions.expiryReminderSentAt, schema.subscriptions.currentPeriodStart)),
        or(eq(schema.subscriptions.source, "manual"), eq(schema.subscriptions.cancelAtPeriodEnd, true)),
      ),
    );
  let subReminders = 0;
  for (const { s, payer } of due) {
    const seats = await db
      .select({ userId: schema.subscriptionSeats.userId })
      .from(schema.subscriptionSeats)
      .where(eq(schema.subscriptionSeats.subscriptionId, s.id));
    const date = dateOnly(s.currentPeriodEnd!);
    const recipients = [...new Set([s.payerId, ...seats.map((x) => x.userId)])];
    await notify(recipients, "accessExpiring", { date }, `/${payer.role === "student" ? "student" : "parent"}/billing`);
    await sendExpiryReminderEmail({ to: payer.email, name: payer.name, locale: payer.locale, date, role: payer.role }).catch((e) =>
      console.error("[cron:billing] email failed", e),
    );
    await db.update(schema.subscriptions).set({ expiryReminderSentAt: now }).where(eq(schema.subscriptions.id, s.id));
    subReminders++;
  }

  // Grant reminders (exact-day match, see doc above)
  const dayStart = new Date(Date.UTC(horizon.getUTCFullYear(), horizon.getUTCMonth(), horizon.getUTCDate()));
  const grants = await db
    .select({ g: schema.accessGrants, u: schema.user })
    .from(schema.accessGrants)
    .innerJoin(schema.user, eq(schema.user.id, schema.accessGrants.userId))
    .where(
      and(
        isNull(schema.accessGrants.revokedAt),
        gte(schema.accessGrants.expiresAt, dayStart),
        lt(schema.accessGrants.expiresAt, new Date(dayStart.getTime() + DAY)),
      ),
    );
  for (const { g, u } of grants) {
    const date = dateOnly(g.expiresAt!);
    await notify(u.id, "accessExpiring", { date }, `/${u.role === "student" ? "student" : "parent"}/billing`);
    await sendExpiryReminderEmail({ to: u.email, name: u.name, locale: u.locale, date, role: u.role }).catch((e) =>
      console.error("[cron:billing] email failed", e),
    );
  }

  return { expired: expired.length, subscriptionReminders: subReminders, grantReminders: grants.length };
}
