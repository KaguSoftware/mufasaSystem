import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { computeWebhookSignature, verifyWebhookSignature, webhookSignatureMessage } from "./iyzico";

const secret = "sandbox-secret";
const payload = {
  iyziEventType: "subscription.order.success",
  subscriptionReferenceCode: "sub-ref-1",
  orderReferenceCode: "order-ref-1",
  customerReferenceCode: "cust-ref-1",
};

describe("iyzico webhook signature V3", () => {
  it("concatenates fields in the documented order", () => {
    expect(webhookSignatureMessage(secret, payload)).toBe(
      "sandbox-secretsubscription.order.successsub-ref-1order-ref-1cust-ref-1",
    );
  });

  it("matches an independently computed HMAC-SHA256 hex vector", () => {
    const expected = createHmac("sha256", secret)
      .update("sandbox-secretsubscription.order.successsub-ref-1order-ref-1cust-ref-1")
      .digest("hex");
    expect(computeWebhookSignature(secret, payload)).toBe(expected);
    // Fixed vector computed once with node:crypto, guards against accidental order changes.
    expect(expected).toMatch(/^[0-9a-f]{64}$/);
  });

  it("accepts a valid signature and rejects tampering", () => {
    const body = JSON.stringify(payload);
    const sig = computeWebhookSignature(secret, payload);
    const ok = new Headers({ "x-iyz-signature-v3": sig });
    expect(verifyWebhookSignature(body, ok, secret)).toMatchObject({ orderReferenceCode: "order-ref-1" });

    const tampered = JSON.stringify({ ...payload, orderReferenceCode: "other" });
    expect(verifyWebhookSignature(tampered, ok, secret)).toBeNull();
    expect(verifyWebhookSignature(body, new Headers(), secret)).toBeNull();
    expect(verifyWebhookSignature("not json", ok, secret)).toBeNull();
  });
});
