import "server-only";
import { z } from "zod";
import { and, desc, eq, getDb, gt, isNotNull, isNull, lte, or, schema, ROLES, type Role } from "@mufasa/db";
import type { I18nText } from "@mufasa/config/locales";
import { audit } from "../audit";
import { forbidden, notFound } from "../errors";
import type { SessionUser } from "../session";

const i18nField = z.object({
  en: z.string().trim().min(1).max(2000),
  ar: z.string().trim().max(2000).optional(),
  tr: z.string().trim().max(2000).optional(),
});

export const announcementSchema = z.object({
  id: z.string().uuid().optional(),
  title: i18nField,
  body: i18nField,
  audience: z.array(z.enum(ROLES)).max(4),
  /** true = published now (keeps the original time when already published). */
  published: z.boolean(),
  /** ISO date or null. */
  expiresAt: z.string().nullable(),
});
export type AnnouncementInput = z.infer<typeof announcementSchema>;

const clean = (v: { en: string; ar?: string; tr?: string }): I18nText => ({
  en: v.en,
  ...(v.ar ? { ar: v.ar } : {}),
  ...(v.tr ? { tr: v.tr } : {}),
});

export async function listAllAnnouncements(actor: SessionUser) {
  if (actor.role !== "admin") throw forbidden();
  return getDb().select().from(schema.announcements).orderBy(desc(schema.announcements.createdAt)).limit(200);
}

export async function saveAnnouncement(actor: SessionUser, input: AnnouncementInput): Promise<{ id: string }> {
  if (actor.role !== "admin") throw forbidden();
  const data = announcementSchema.parse(input);
  const db = getDb();
  const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
  if (data.id) {
    const before = await db.query.announcements.findFirst({ where: eq(schema.announcements.id, data.id) });
    if (!before) throw notFound();
    const publishedAt = data.published ? (before.publishedAt ?? new Date()) : null;
    await db
      .update(schema.announcements)
      .set({ title: clean(data.title), body: clean(data.body), audience: data.audience, publishedAt, expiresAt })
      .where(eq(schema.announcements.id, data.id));
    await audit({
      actorId: actor.id,
      action: "announcement.update",
      entity: "announcements",
      entityId: data.id,
      before: { title: before.title, audience: before.audience, publishedAt: before.publishedAt, expiresAt: before.expiresAt },
      after: { title: data.title, audience: data.audience, published: data.published, expiresAt },
    });
    return { id: data.id };
  }
  const [row] = await db
    .insert(schema.announcements)
    .values({
      title: clean(data.title),
      body: clean(data.body),
      audience: data.audience,
      publishedAt: data.published ? new Date() : null,
      expiresAt,
      createdBy: actor.id,
    })
    .returning({ id: schema.announcements.id });
  await audit({ actorId: actor.id, action: "announcement.create", entity: "announcements", entityId: row!.id, after: { title: data.title, audience: data.audience } });
  return { id: row!.id };
}

export async function deleteAnnouncement(actor: SessionUser, id: string): Promise<void> {
  if (actor.role !== "admin") throw forbidden();
  const db = getDb();
  const before = await db.query.announcements.findFirst({ where: eq(schema.announcements.id, id) });
  if (!before) throw notFound();
  await db.delete(schema.announcements).where(eq(schema.announcements.id, id));
  await audit({ actorId: actor.id, action: "announcement.delete", entity: "announcements", entityId: id, before: { title: before.title } });
}

/** Active (published, not expired) announcements visible to `role`. No auth: the data is not sensitive. */
export async function getActiveAnnouncements(role: Role, limit = 5) {
  const now = new Date();
  const rows = await getDb()
    .select()
    .from(schema.announcements)
    .where(
      and(
        isNotNull(schema.announcements.publishedAt),
        lte(schema.announcements.publishedAt, now),
        or(isNull(schema.announcements.expiresAt), gt(schema.announcements.expiresAt, now)),
      ),
    )
    .orderBy(desc(schema.announcements.publishedAt))
    .limit(50);
  return rows.filter((a) => a.audience.length === 0 || a.audience.includes(role)).slice(0, limit);
}
