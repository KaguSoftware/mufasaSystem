"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "../action";
import { requestDataAction, reviewDataRequest } from "../dal/data-requests";

export const requestData = action(
  { input: z.object({ subjectUserId: z.string().min(1), type: z.enum(["export", "delete"]) }), rateLimit: "data.request" },
  async (input, { user }) => {
    const res = await requestDataAction(user, input);
    revalidatePath("/[locale]", "layout");
    return res;
  },
);

export const reviewRequest = action(
  {
    input: z.object({ requestId: z.string().uuid(), decision: z.enum(["approve", "reject"]), note: z.string().trim().max(500).optional() }),
    roles: ["admin"],
  },
  async (input, { user }) => {
    await reviewDataRequest(user, input);
    revalidatePath("/[locale]/admin/users", "page");
    return { ok: true as const };
  },
);
