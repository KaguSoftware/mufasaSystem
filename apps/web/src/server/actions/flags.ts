"use server";
import { revalidatePath } from "next/cache";
import { action } from "../action";
import { upsertFlag as upsertFlagDal, upsertFlagSchema } from "../dal/flags-admin";

export const upsertFlag = action({ input: upsertFlagSchema, roles: ["admin"] }, async (input, { user }) => {
  await upsertFlagDal(user, input);
  revalidatePath("/[locale]/admin/flags", "page");
  return { ok: true as const };
});
