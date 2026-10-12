import { apiError } from "@/server/action";
import { applyWebhookEvent } from "@/server/dal/billing-iyzico";
import { verifyWebhookSignature } from "@/server/services/iyzico";

/** iyzico subscription webhook. Signature (X-IYZ-SIGNATURE-V3) is verified before anything is read. */
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const payload = verifyWebhookSignature(raw, req.headers);
    if (!payload) return Response.json({ ok: false, error: { code: "unauthorized" } }, { status: 401 });
    const res = await applyWebhookEvent(payload);
    return Response.json({ ok: true, ...res });
  } catch (err) {
    return apiError(err);
  }
}
