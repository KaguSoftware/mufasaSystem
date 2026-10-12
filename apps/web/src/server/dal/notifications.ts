import "server-only";
import { and, count, desc, eq, getDb, inArray, isNull, schema } from "@mufasa/db";
import type { SessionUser } from "../session";

export const NOTIFICATIONS_PAGE_SIZE = 20;

export type NotificationItem = {
  id: string;
  type: string;
  params: Record<string, string | number>;
  href: string | null;
  read: boolean;
  createdAt: Date;
};

export async function listNotifications(
  actor: SessionUser,
  opts: { page?: number } = {},
): Promise<{ items: NotificationItem[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const db = getDb();
  const where = eq(schema.notifications.userId, actor.id);
  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(schema.notifications)
      .where(where)
      .orderBy(desc(schema.notifications.createdAt))
      .limit(NOTIFICATIONS_PAGE_SIZE)
      .offset((page - 1) * NOTIFICATIONS_PAGE_SIZE),
    db.select({ n: count() }).from(schema.notifications).where(where),
  ]);
  return {
    items: rows.map((r) => ({
      id: r.id,
      type: r.type,
      params: r.params,
      href: r.href,
      read: Boolean(r.readAt),
      createdAt: r.createdAt,
    })),
    total: total?.n ?? 0,
    page,
    pageSize: NOTIFICATIONS_PAGE_SIZE,
  };
}

export async function unreadCount(actor: SessionUser): Promise<number> {
  const [r] = await getDb()
    .select({ n: count() })
    .from(schema.notifications)
    .where(and(eq(schema.notifications.userId, actor.id), isNull(schema.notifications.readAt)));
  return r?.n ?? 0;
}

export async function markRead(actor: SessionUser, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await getDb()
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(schema.notifications.userId, actor.id),
        inArray(schema.notifications.id, ids),
        isNull(schema.notifications.readAt),
      ),
    );
}

export async function markAllRead(actor: SessionUser): Promise<void> {
  await getDb()
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(and(eq(schema.notifications.userId, actor.id), isNull(schema.notifications.readAt)));
}
