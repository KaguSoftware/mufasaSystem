import { env } from "@/env";
import { apiError } from "@/server/action";
import { runLiveCron } from "@/server/dal/live-cron";

export const dynamic = "force-dynamic";

/** Vercel Cron (every 15 minutes): GET with `Authorization: Bearer ${CRON_SECRET}`. Fails closed when the secret is missing. */
export async function GET(req: Request) {
  const secret = env().CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: { code: "unauthorized" } }, { status: 401 });
  }
  try {
    return Response.json({ ok: true, ...(await runLiveCron()) });
  } catch (err) {
    return apiError(err);
  }
}
