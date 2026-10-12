import "server-only";
import { headers } from "next/headers";
import { getDb, schema } from "@mufasa/db";

/**
 * Record an admin/staff action. Call it for every privileged mutation
 * (grants, approvals, role changes, deletions, settings, flags).
 */
export async function audit(entry: {
  actorId: string | null;
  action: string; // e.g. "access.grant", "payment.approve", "user.role_change"
  entity: string; // table-ish name, e.g. "access_grants"
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  let ip: string | null = null;
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  } catch {
    // called outside a request (cron/worker)
  }
  await getDb()
    .insert(schema.auditLog)
    .values({ ...entry, entityId: entry.entityId ?? null, ipAddress: ip });
}
