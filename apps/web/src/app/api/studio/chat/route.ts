import { z } from "zod";
import { apiError } from "@/server/action";
import { requireFlag } from "@/server/flags";
import { enforceRateLimit } from "@/server/rate-limit";
import { requireRole } from "@/server/session";
import { streamChatReply } from "@/server/services/ai-studio";
import { AGE_BANDS } from "@/lib/ai-studio";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().trim().min(1).max(8000),
  ageBand: z.enum(AGE_BANDS as unknown as [string, ...string[]]).optional(),
});

/** POST { conversationId, message } -> streams the model reply as plain UTF-8 text. */
export async function POST(req: Request) {
  try {
    const user = await requireRole("tutor", "admin");
    await requireFlag("ai_studio", user);
    await enforceRateLimit("ai.chat", user.id, user.role);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AppError("validation");
    const stream = await streamChatReply(user, { ...parsed.data, ageBand: parsed.data.ageBand as never }, req.signal);
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
    });
  } catch (err) {
    return apiError(err);
  }
}
