"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "../action";
import * as family from "../dal/family";

export const createChild = action(
  { input: family.createChildSchema, roles: ["parent"], rateLimit: "family.create" },
  async (input, { user }) => {
    const res = await family.createChild(user, input);
    revalidatePath("/[locale]/parent", "layout");
    return res;
  },
);

export const updateChild = action({ input: family.updateChildSchema, roles: ["parent"] }, async (input, { user }) => {
  await family.updateChild(user, input);
  revalidatePath("/[locale]/parent", "layout");
  return { ok: true as const };
});

export const resetChildPin = action(
  { input: z.object({ childId: z.string().min(1), pin: z.string().regex(family.PIN_RE) }), roles: ["parent"] },
  async (input, { user }) => {
    await family.resetChildPin(user, input.childId, input.pin);
    return { ok: true as const };
  },
);

export const updateConsent = action(
  { input: z.object({ childId: z.string().min(1), consent: family.consentSchema }), roles: ["parent"] },
  async (input, { user }) => {
    await family.updateConsent(user, input.childId, input.consent);
    revalidatePath("/[locale]/parent", "layout");
    return { ok: true as const };
  },
);
