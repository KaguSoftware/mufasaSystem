import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { i18n, id, timestamps } from "./_shared";
import { user } from "./auth";
import { courses, programs } from "./catalog";

export type Currency = "TRY" | "USD" | "EUR";
export type BillingInterval = "month" | "quarter" | "year" | "one_time";

export const plans = pgTable("plans", {
  id: id(),
  slug: text().notNull().unique(),
  name: i18n().notNull(),
  description: i18n(),
  /** Minor units (kuruş / cents). */
  priceMinor: integer().notNull(),
  currency: text().$type<Currency>().notNull().default("TRY"),
  interval: text().$type<BillingInterval>().notNull().default("month"),
  /** Days granted per period for manual (IBAN) purchases. */
  periodDays: integer().notNull().default(30),
  /** Empty = unlocks every program. */
  programIds: uuid().array().notNull().default([]),
  /** Number of child seats a family plan covers. */
  seats: integer().notNull().default(1),
  liveClassesPerMonth: integer().notNull().default(0),
  features: jsonb().$type<string[]>().notNull().default([]),
  /** iyzico subscription pricing plan reference code (created in iyzico panel/API). */
  iyzicoPricingPlanRef: text(),
  active: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
  ...timestamps,
});

export type SubscriptionStatus = "pending" | "active" | "past_due" | "cancelled" | "expired";

/** One billing relationship. `source` distinguishes iyzico vs manual (WhatsApp/IBAN). */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    /** Paying account (usually the parent). */
    payerId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    planId: uuid()
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    source: text().$type<"iyzico" | "manual">().notNull(),
    status: text().$type<SubscriptionStatus>().notNull().default("pending"),
    currentPeriodStart: timestamp({ withTimezone: true }),
    currentPeriodEnd: timestamp({ withTimezone: true }),
    cancelAtPeriodEnd: boolean().notNull().default(false),
    iyzicoSubscriptionRef: text().unique(),
    iyzicoCustomerRef: text(),
    couponId: uuid(),
    expiryReminderSentAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index().on(t.payerId), index().on(t.status, t.currentPeriodEnd)],
);

/** Which learners a subscription covers (family plans cover several children). */
export const subscriptionSeats = pgTable(
  "subscription_seats",
  {
    id: id(),
    subscriptionId: uuid()
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId), index().on(t.subscriptionId)],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    payerId: text()
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    subscriptionId: uuid().references(() => subscriptions.id, { onDelete: "set null" }),
    provider: text().$type<"iyzico" | "manual">().notNull(),
    providerRef: text(),
    amountMinor: integer().notNull(),
    currency: text().$type<Currency>().notNull(),
    status: text().$type<"pending" | "succeeded" | "failed" | "refunded">().notNull(),
    raw: jsonb().$type<Record<string, unknown>>(),
    paidAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.payerId), index().on(t.providerRef)],
);

/** "I paid via IBAN / WhatsApp": reviewed by an admin. */
export const manualPaymentRequests = pgTable(
  "manual_payment_requests",
  {
    id: id(),
    payerId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    planId: uuid()
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    /** Learners to cover. Defaults to the payer's children (or the payer). */
    learnerIds: text().array().notNull().default([]),
    amountMinor: integer().notNull(),
    currency: text().$type<Currency>().notNull(),
    /** Private bucket "receipts". Optional: some pay and just message on WhatsApp. */
    receiptPath: text(),
    senderName: text(),
    note: text(),
    status: text().$type<"pending" | "approved" | "rejected">().notNull().default("pending"),
    reviewedBy: text().references(() => user.id, { onDelete: "set null" }),
    reviewNote: text(),
    reviewedAt: timestamp({ withTimezone: true }),
    subscriptionId: uuid().references(() => subscriptions.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index().on(t.status), index().on(t.payerId)],
);

export const coupons = pgTable("coupons", {
  id: id(),
  code: text().notNull().unique(),
  percentOff: integer(),
  amountOffMinor: integer(),
  currency: text().$type<Currency>(),
  maxRedemptions: integer(),
  redemptions: integer().notNull().default(0),
  planIds: uuid().array().notNull().default([]),
  validFrom: timestamp({ withTimezone: true }),
  validUntil: timestamp({ withTimezone: true }),
  active: boolean().notNull().default(true),
  ...timestamps,
});

/**
 * Admin overrides: grant a user access regardless of subscription.
 * Scope: all content, a program, or a single course.
 */
export const accessGrants = pgTable(
  "access_grants",
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    scope: text().$type<"all" | "program" | "course">().notNull().default("all"),
    programId: uuid().references(() => programs.id, { onDelete: "cascade" }),
    courseId: uuid().references(() => courses.id, { onDelete: "cascade" }),
    startsAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Null = never expires. */
    expiresAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    reason: text(),
    grantedBy: text().references(() => user.id, { onDelete: "set null" }),
    manualPaymentRequestId: uuid().references(() => manualPaymentRequests.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index().on(t.userId)],
);
