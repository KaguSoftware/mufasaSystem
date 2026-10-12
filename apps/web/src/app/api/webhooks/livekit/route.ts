import { apiError } from "@/server/action";
import { handleLivekitEvent } from "@/server/dal/live-cron";
import { receiveWebhook } from "@/server/services/livekit";

export const dynamic = "force-dynamic";

/**
 * LiveKit webhooks (participant_joined / participant_left / room_finished).
 * Signature is verified from the raw body and the Authorization header.
 */
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    let event;
    try {
      event = await receiveWebhook(raw, req.headers.get("authorization"));
    } catch (err) {
      // Not configured stays a 503 (apiError); a bad signature is a 401.
      if (err instanceof Error && err.name === "AppError") throw err;
      return Response.json({ ok: false, error: { code: "unauthorized" } }, { status: 401 });
    }
    const res = await handleLivekitEvent(event);
    return Response.json({ ok: true, ...res });
  } catch (err) {
    return apiError(err);
  }
}
