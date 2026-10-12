"use server";

import { z } from "zod";
import { action } from "../action";
import * as access from "../dal/access-admin";

export const searchUsersAction = action(
  { input: z.object({ query: z.string().max(100) }), roles: ["admin"] },
  async ({ query }, { user }) => access.searchUsers(user, query),
);

export const getUserAccessAction = action(
  { input: z.object({ userId: z.string().min(1) }), roles: ["admin"] },
  async ({ userId }, { user }) => access.listUserAccess(user, userId),
);

export const accessTargetsAction = action({ input: z.object({}), roles: ["admin"] }, async (_i, { user }) =>
  access.accessTargets(user),
);

export const grantAccessAction = action({ input: access.grantInputSchema, roles: ["admin"] }, async (input, { user }) =>
  access.grantAccess(user, input),
);

export const extendGrantAction = action({ input: access.extendGrantSchema, roles: ["admin"] }, async (input, { user }) =>
  access.extendGrant(user, input),
);

export const revokeGrantAction = action(
  { input: z.object({ grantId: z.string().uuid() }), roles: ["admin"] },
  async ({ grantId }, { user }) => access.revokeGrant(user, grantId),
);

export const extendSubscriptionAction = action(
  { input: access.extendSubscriptionSchema, roles: ["admin"] },
  async (input, { user }) => access.extendSubscription(user, input),
);

export const cancelSubscriptionAction = action(
  { input: z.object({ subscriptionId: z.string().uuid() }), roles: ["admin"] },
  async ({ subscriptionId }, { user }) => access.cancelSubscription(user, subscriptionId),
);
