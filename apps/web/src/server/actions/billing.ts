"use server";

import { z } from "zod";
import { action, toActionError, type ActionResult } from "../action";
import { requireFlag } from "../flags";
import { enforceRateLimit } from "../rate-limit";
import { requireUser } from "../session";
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
export async function uploadReceiptAction(formData: FormData): Promise<ActionResult<{ path: string }>> {
  try {
    const user = await requireUser();
    await requireFlag("manual_payments", user);
    await enforceRateLimit("upload.receipt", user.id, user.role);
    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, error: { code: "validation", fieldErrors: { file: ["required"] } } };
    return { ok: true, data: await billing.uploadReceipt(user, file) };
  } catch (err) {
    return { ok: false, error: toActionError(err) };
  }
}

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
