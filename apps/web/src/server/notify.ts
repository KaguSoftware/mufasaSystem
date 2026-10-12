import "server-only";
import { getDb, schema } from "@mufasa/db";
import type en from "@messages/en";

export type NotificationType = keyof (typeof en)["notifications"];

/**
 * In-app notification. Stored as a message key + params so it renders in the
 * viewer's language (messages/*.ts → notifications.<type>).
 */
export async function notify(
  userIds: string | string[],
  type: NotificationType,
  params: Record<string, string | number> = {},
  href?: string,
) {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  if (!ids.length) return;
  await getDb()
    .insert(schema.notifications)
    .values(ids.map((userId) => ({ userId, type, params, href })));
}
