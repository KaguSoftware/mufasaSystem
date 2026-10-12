"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "../action";
import * as a from "../dal/announcements";

export const saveAnnouncement = action({ input: a.announcementSchema, roles: ["admin"] }, async (input, { user }) => {
  const res = await a.saveAnnouncement(user, input);
  revalidatePath("/[locale]", "layout");
  return res;
});

export const deleteAnnouncement = action({ input: z.object({ id: z.string().uuid() }), roles: ["admin"] }, async (input, { user }) => {
  await a.deleteAnnouncement(user, input.id);
  revalidatePath("/[locale]", "layout");
  return { ok: true as const };
});
