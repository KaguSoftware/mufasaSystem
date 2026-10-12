"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "../action";
import * as users from "../dal/admin-users";

const refresh = () => revalidatePath("/[locale]/admin/users", "page");

export const createStaff = action({ input: users.createStaffSchema, roles: ["admin"] }, async (input, { user }) => {
  const res = await users.createStaffUser(user, input);
  refresh();
  return res;
});

export const setRole = action({ input: users.setRoleSchema, roles: ["admin"] }, async (input, { user }) => {
  await users.setUserRole(user, input);
  refresh();
  return { ok: true as const };
});

export const ban = action({ input: users.banSchema, roles: ["admin"] }, async (input, { user }) => {
  await users.banUser(user, input);
  refresh();
  return { ok: true as const };
});

export const unban = action({ input: z.object({ userId: z.string().min(1) }), roles: ["admin"] }, async (input, { user }) => {
  await users.unbanUser(user, input.userId);
  refresh();
  return { ok: true as const };
});

export const impersonate = action({ input: z.object({ userId: z.string().min(1) }), roles: ["admin"] }, async (input, { user }) => {
  await users.impersonate(user, input.userId);
  return { ok: true as const };
});

export const familyLinks = action({ input: z.object({ userId: z.string().min(1) }), roles: ["admin"] }, async (input, { user }) =>
  users.getFamilyLinks(user, input.userId),
);
