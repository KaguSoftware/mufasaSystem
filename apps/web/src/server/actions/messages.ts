"use server";
import { z } from "zod";
import { action } from "../action";
import * as messages from "../dal/messages";

export const startThread = action(
  { input: messages.startThreadSchema, flag: "parent_messaging", rateLimit: "messages.send" },
  async (input, { user }) => messages.startThread(user, input),
);

export const sendMessage = action(
  { input: messages.sendMessageSchema, flag: "parent_messaging", rateLimit: "messages.send" },
  async (input, { user }) => messages.sendMessage(user, input),
);

export const markThreadRead = action({ input: z.object({ threadId: z.string().uuid() }) }, async (input, { user }) => {
  await messages.markRead(user, input.threadId);
  return { ok: true as const };
});
