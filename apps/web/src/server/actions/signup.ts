"use server";
import { z } from "zod";
import { action } from "../action";
import { completeSignup as completeSignupDal, completeSignupSchema, updateOwnProfile as updateOwnProfileDal } from "../dal/signup";

export const completeSignup = action({ input: completeSignupSchema }, async (input, { user }) => completeSignupDal(user, input));

export const updateOwnProfile = action(
  { input: z.object({ displayName: z.string().trim().min(1).max(60), birthYear: z.number().int().nullable().optional() }) },
  async (input, { user }) => {
    await updateOwnProfileDal(user, input);
    return { ok: true as const };
  },
);
