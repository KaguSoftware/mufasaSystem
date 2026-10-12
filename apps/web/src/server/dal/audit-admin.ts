import "server-only";
import { aliasedTable, and, count, desc, eq, getDb, ilike, schema } from "@mufasa/db";
import { forbidden } from "../errors";
import type { SessionUser } from "../session";

export const AUDIT_PAGE_SIZE = 30;

export type AuditRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorName: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  createdAt: Date;
};

export async function listAudit(
  actor: SessionUser,
  opts: { entity?: string; action?: string; page?: number } = {},
): Promise<{ rows: AuditRow[]; total: number; page: number; pageSize: number; entities: string[] }> {
  if (actor.role !== "admin") throw forbidden();
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const esc = (s: string) => s.replace(/[%_\\]/g, (c) => `\\${c}`);
  const where = and(
    opts.entity ? eq(schema.auditLog.entity, opts.entity) : undefined,
    opts.action ? ilike(schema.auditLog.action, `%${esc(opts.action.trim())}%`) : undefined,
  );
  const db = getDb();
  const actorUser = aliasedTable(schema.user, "actor_user");
  const [rows, [total], entityRows] = await Promise.all([
    db
      .select({
        id: schema.auditLog.id,
        action: schema.auditLog.action,
        entity: schema.auditLog.entity,
        entityId: schema.auditLog.entityId,
        actorName: actorUser.name,
        before: schema.auditLog.before,
        after: schema.auditLog.after,
        ipAddress: schema.auditLog.ipAddress,
        createdAt: schema.auditLog.createdAt,
      })
      .from(schema.auditLog)
      .leftJoin(actorUser, eq(actorUser.id, schema.auditLog.actorId))
      .where(where)
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(AUDIT_PAGE_SIZE)
      .offset((page - 1) * AUDIT_PAGE_SIZE),
    db.select({ n: count() }).from(schema.auditLog).where(where),
    db.selectDistinct({ entity: schema.auditLog.entity }).from(schema.auditLog).orderBy(schema.auditLog.entity).limit(100),
  ]);
  return { rows, total: total?.n ?? 0, page, pageSize: AUDIT_PAGE_SIZE, entities: entityRows.map((e) => e.entity) };
}
