import { env } from "@/env";
import { apiError } from "@/server/action";
import { runHomeworkDueCron } from "@/server/dal/homework";

export const dynamic = "force-dynamic";

/**
 * Hourly Vercel Cron: notifies students about homework due within 24h that they have not
 * submitted. Deduped by an existing homeworkDue notification (href carries the homework id),
 * so running it more often than hourly is harmless.
 */
export async function GET(req: Request) {
  const secret = env().CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: { code: "unauthorized" } }, { status: 401 });
  }
  try {
    return Response.json({ ok: true, ...(await runHomeworkDueCron()) });
  } catch (err) {
    return apiError(err);
  }
}
