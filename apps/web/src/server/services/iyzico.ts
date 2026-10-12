import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env, isConfigured } from "@/env";
import { AppError } from "../errors";

/** Minimal shape of the payload iyzico sends to the subscription webhook. */
export type IyzicoWebhookPayload = {
  iyziEventType?: string;
  iyziEventTime?: number;
  iyziReferenceCode?: string;
  orderReferenceCode?: string;
  customerReferenceCode?: string;
  subscriptionReferenceCode?: string;
};

export const IYZICO_SIGNATURE_HEADER = "x-iyz-signature-v3";

/**
 * ISOLATED FIELD ORDER (iyzico webhook signature V3, subscription events):
 *   secretKey + iyziEventType + subscriptionReferenceCode + orderReferenceCode + customerReferenceCode
 * The signature is hex(HMAC-SHA256(key = secretKey, message = the string above)).
 * If iyzico changes the order or adds fields, this is the only function to touch.
 */
export function webhookSignatureMessage(secretKey: string, p: IyzicoWebhookPayload): string {
  return (
    secretKey +
    (p.iyziEventType ?? "") +
    (p.subscriptionReferenceCode ?? "") +
    (p.orderReferenceCode ?? "") +
    (p.customerReferenceCode ?? "")
  );
}

export function computeWebhookSignature(secretKey: string, p: IyzicoWebhookPayload): string {
  return createHmac("sha256", secretKey).update(webhookSignatureMessage(secretKey, p)).digest("hex");
}

/** Constant-time check. Returns the parsed payload when valid, otherwise null. */
export function verifyWebhookSignature(
  rawBody: string,
  headers: Pick<Headers, "get">,
  secretKey: string | undefined = env().IYZICO_SECRET_KEY,
): IyzicoWebhookPayload | null {
  if (!secretKey) throw new AppError("integration_not_configured", "iyzico");
  const given = headers.get(IYZICO_SIGNATURE_HEADER);
  if (!given) return null;
  let payload: IyzicoWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as IyzicoWebhookPayload;
  } catch {
    return null;
  }
  const expected = Buffer.from(computeWebhookSignature(secretKey, payload), "utf8");
  const actual = Buffer.from(given.trim().toLowerCase(), "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return payload;
}

// ───────────────────────────── API wrapper ─────────────────────────────

type Callback<T> = (err: Error | null, result: T) => void;

async function client() {
  if (!isConfigured("iyzico")) throw new AppError("integration_not_configured", "iyzico");
  const mod = await import("iyzipay");
  const Iyzipay = (mod as unknown as { default?: typeof mod.default }).default ?? mod.default;
  const e = env();
  return new Iyzipay({ apiKey: e.IYZICO_API_KEY!, secretKey: e.IYZICO_SECRET_KEY!, uri: e.IYZICO_BASE_URL });
}

function call<T>(fn: (cb: Callback<T>) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    fn((err, result) => (err ? reject(err) : resolve(result)));
  });
}

export type CheckoutPayer = {
  name: string;
  surname: string;
  email: string;
  identityNumber: string;
  gsmNumber?: string;
  address?: string;
  city?: string;
  zipCode?: string;
};

export async function initSubscriptionCheckout(opts: {
  /** iyzico pricing plan reference (plans.iyzicoPricingPlanRef). */
  pricingPlanRef: string;
  payer: CheckoutPayer;
  callbackUrl: string;
  /** Echoed back by iyzico; we pass our subscription id. */
  conversationId: string;
  locale?: "tr" | "en";
}): Promise<{ token: string; checkoutFormContent: string }> {
  const iyzipay = await client();
  const addr = {
    contactName: `${opts.payer.name} ${opts.payer.surname}`.trim(),
    city: opts.payer.city || "Istanbul",
    country: "Turkey",
    address: opts.payer.address || "N/A",
    zipCode: opts.payer.zipCode,
  };
  const res = await call<{ status: string; token: string; checkoutFormContent: string; errorMessage?: string }>((cb) =>
    iyzipay.subscriptionCheckoutForm.initialize(
      {
        locale: (opts.locale ?? "tr") as never,
        conversationId: opts.conversationId,
        callbackUrl: opts.callbackUrl,
        pricingPlanReferenceCode: opts.pricingPlanRef,
        subscriptionInitialStatus: "ACTIVE",
        customer: {
          name: opts.payer.name,
          surname: opts.payer.surname,
          identityNumber: opts.payer.identityNumber,
          email: opts.payer.email,
          gsmNumber: opts.payer.gsmNumber,
          billingAddress: addr,
          shippingAddress: addr,
        },
      },
      cb as never,
    ),
  );
  if (res.status !== "success") throw new AppError("internal", res.errorMessage ?? "iyzico initialize failed");
  return { token: res.token, checkoutFormContent: res.checkoutFormContent };
}

export type CheckoutResult = {
  ok: boolean;
  subscriptionRef: string;
  customerRef: string;
  pricingPlanRef: string;
  conversationId?: string;
  subscriptionStatus: string;
  startDate?: string;
};

export async function retrieveCheckout(token: string): Promise<CheckoutResult> {
  const iyzipay = await client();
  const res = await call<{
    status: string;
    conversationId?: string;
    referenceCode?: string;
    customerReferenceCode?: string;
    pricingPlanReferenceCode?: string;
    subscriptionStatus?: string;
    startDate?: string;
  }>((cb) => iyzipay.subscriptionCheckoutForm.retrieve({ token }, cb as never));
  return {
    ok: res.status === "success" && Boolean(res.referenceCode),
    subscriptionRef: res.referenceCode ?? "",
    customerRef: res.customerReferenceCode ?? "",
    pricingPlanRef: res.pricingPlanReferenceCode ?? "",
    conversationId: res.conversationId,
    subscriptionStatus: res.subscriptionStatus ?? "",
    startDate: res.startDate,
  };
}
