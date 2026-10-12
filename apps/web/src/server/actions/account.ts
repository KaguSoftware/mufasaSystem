"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "../action";
import { assertImpersonating, updateAccount as updateAccountDal, updateAccountSchema } from "../dal/account";
import { stopImpersonating as stopImpersonatingDal } from "../dal/admin-users";
import { getSession } from "../session";

export const updateAccount = action({ input: updateAccountSchema }, async (input, { user }) => {
  await updateAccountDal(user, input);
  revalidatePath("/[locale]", "layout");
  return { ok: true as const };
});

/** Ends an admin impersonation session and restores the original admin session. */
export const stopImpersonating = action({ input: z.object({}) }, async (_input, { user }) => {
  const session = await getSession();
  if (session) await assertImpersonating(session.sessionId);
  await stopImpersonatingDal(user);
  return { ok: true as const };
});
