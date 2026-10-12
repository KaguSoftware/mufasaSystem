import { z } from "zod";
import { apiError } from "@/server/action";
import { joinSession } from "@/server/dal/live";
import { AppError } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

const body = z.object({ sessionId: z.string().uuid() });

/**
 * POST { sessionId } -> { ok: true, kind: "livekit", token, url, role } | { ok: true, kind: "external", url, role }.
 * All child-safety gates (membership, parental consent, time window, tutor-first) live in joinSession.
 * A student polling before the tutor arrives gets 409 with message "tutor_not_joined".
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AppError("validation");
    await enforceRateLimit("live.token", user.id, user.role);
    const res = await joinSession(user, parsed.data.sessionId);
    return Response.json({ ok: true, ...res }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return apiError(err);
  }
}
