"use server";

import { z } from "zod";
import { action } from "../action";
import { AppError, forbidden } from "../errors";
import * as billing from "../dal/billing";
import { cardCheckoutInputSchema, startCardCheckout } from "../dal/billing-iyzico";

const idSchema = z.object({ id: z.string().uuid() });

// ───────── Family / student side ─────────

export const quotePayment = action(
  { input: billing.quoteInputSchema, roles: ["parent", "student"], flag: "manual_payments" },
  async (input, { user }) => billing.quoteManualPayment(user, input),
);

export const submitPaymentRequest = action(
  { input: billing.manualRequestInputSchema, roles: ["parent", "student"], flag: "manual_payments", rateLimit: "upload.receipt" },
  async (input, { user }) => billing.createManualPaymentRequest(user, input),
);

/** Receives FormData with a `file` field. Returns the stored object path to pass to submitPaymentRequest. */
export const uploadReceiptAction = action(
  { input: z.instanceof(FormData), roles: ["parent", "student"], flag: "manual_payments", rateLimit: "upload.receipt" },
  async (formData, { user }) => {
    // Managed children never pay; their parents do.
    if (user.isManagedChild) throw forbidden();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new AppError("validation", "file", { file: ["required"] });
    return billing.uploadReceipt(user, file);
  },
);

export const startCardCheckoutAction = action(
  { input: cardCheckoutInputSchema, roles: ["parent", "student"], flag: "iyzico_checkout" },
  async (input, { user }) => startCardCheckout(user, input),
);

// ───────── Admin: payment requests ─────────

export const getReceiptUrlAction = action({ input: idSchema, roles: ["admin"] }, async ({ id }, { user }) =>
  billing.getReceiptUrl(user, id),
);

export const approvePaymentAction = action(
  { input: billing.approveInputSchema, roles: ["admin"] },
  async (input, { user }) => billing.approvePaymentRequest(user, input),
);

export const rejectPaymentAction = action(
  { input: billing.rejectInputSchema, roles: ["admin"] },
  async (input, { user }) => billing.rejectPaymentRequest(user, input),
);

// ───────── Admin: plans and coupons ─────────

export const savePlanAction = action({ input: billing.planInputSchema, roles: ["admin"] }, async (input, { user }) =>
  billing.upsertPlan(user, input),
);

export const saveCouponAction = action({ input: billing.couponInputSchema, roles: ["admin"] }, async (input, { user }) =>
  billing.upsertCoupon(user, input),
);

export const deleteCouponAction = action({ input: idSchema, roles: ["admin"] }, async ({ id }, { user }) => {
  await billing.deleteCoupon(user, id);
  return { id };
});
