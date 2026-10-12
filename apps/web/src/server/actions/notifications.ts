"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "../action";
import * as n from "../dal/notifications";

export const markNotificationRead = action({ input: z.object({ ids: z.array(z.string().uuid()).max(100) }) }, async (input, { user }) => {
  await n.markRead(user, input.ids);
  revalidatePath("/[locale]", "layout");
  return { ok: true as const };
});

export const markAllNotificationsRead = action({ input: z.object({}) }, async (_input, { user }) => {
  await n.markAllRead(user);
  revalidatePath("/[locale]", "layout");
  return { ok: true as const };
});
