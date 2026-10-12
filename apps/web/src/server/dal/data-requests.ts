import "server-only";
import { aliasedTable, and, count, desc, eq, getDb, inArray, ne, schema } from "@mufasa/db";
import { audit } from "../audit";
import { AppError, forbidden, notFound } from "../errors";
import { enqueueJob } from "../jobs";
import { isParentOf, type SessionUser } from "../session";

export type DataRequestType = "export" | "delete";

/** Parent (for self or child) or an adult user (self only) may request. Managed children cannot. */
async function assertCanRequest(actor: SessionUser, subjectUserId: string) {
  if (actor.isManagedChild) throw forbidden();
  if (actor.id === subjectUserId) return;
  if (actor.role === "parent" && (await isParentOf(actor.id, subjectUserId))) return;
  throw forbidden();
}

export async function requestDataAction(
  actor: SessionUser,
  input: { subjectUserId: string; type: DataRequestType },
): Promise<{ id: string; status: "pending" | "approved" }> {
  await assertCanRequest(actor, input.subjectUserId);
  const db = getDb();
  if (input.type === "delete") {
    const subject = await db.query.user.findFirst({ where: eq(schema.user.id, input.subjectUserId), columns: { role: true } });
    if (!subject) throw notFound();
    if (subject.role === "admin" || subject.role === "tutor") {
      throw new AppError("forbidden", "staff_accounts_are_deleted_by_an_admin");
    }
  }
  const open = await db.query.dataRequests.findFirst({
    where: and(
      eq(schema.dataRequests.subjectUserId, input.subjectUserId),
      eq(schema.dataRequests.type, input.type),
      eq(schema.dataRequests.status, "pending"),
    ),
    columns: { id: true },
  });
  if (open) throw new AppError("conflict", "request_already_pending");

  const exportNow = input.type === "export";
  const [row] = await db
    .insert(schema.dataRequests)
    .values({
      subjectUserId: input.subjectUserId,
      requestedBy: actor.id,
      type: input.type,
      // Exports of your own (or your child's) data need no review: the worker builds the file.
      status: exportNow ? "approved" : "pending",
    })
    .returning({ id: schema.dataRequests.id, status: schema.dataRequests.status });
  if (exportNow) await enqueueJob("data_export", { requestId: row!.id }, { dedupeKey: `data_export:${row!.id}` });
  return { id: row!.id, status: row!.status as "pending" | "approved" };
}

export type MyDataRequest = {
  id: string;
  subjectUserId: string;
  subjectName: string;
  type: DataRequestType;
  status: "pending" | "approved" | "rejected" | "completed";
  createdAt: Date;
  hasResult: boolean;
};

/** Requests the actor made (for self or their children). */
export async function listMyDataRequests(actor: SessionUser): Promise<MyDataRequest[]> {
  const rows = await getDb()
    .select({
      id: schema.dataRequests.id,
      subjectUserId: schema.dataRequests.subjectUserId,
      subjectName: schema.user.name,
      type: schema.dataRequests.type,
      status: schema.dataRequests.status,
      createdAt: schema.dataRequests.createdAt,
      resultPath: schema.dataRequests.resultPath,
    })
    .from(schema.dataRequests)
    .innerJoin(schema.user, eq(schema.user.id, schema.dataRequests.subjectUserId))
    .where(eq(schema.dataRequests.requestedBy, actor.id))
    .orderBy(desc(schema.dataRequests.createdAt))
    .limit(50);
  return rows.map((r) => ({
    id: r.id,
    subjectUserId: r.subjectUserId,
    subjectName: r.subjectName,
    type: r.type,
    status: r.status,
    createdAt: r.createdAt,
    hasResult: Boolean(r.resultPath),
  }));
}

// ───────────── Admin ─────────────

export type AdminDataRequest = {
  id: string;
  type: DataRequestType;
  status: "pending" | "approved" | "rejected" | "completed";
  subjectUserId: string;
  subjectName: string;
  subjectEmail: string;
  subjectRole: string;
  requestedByName: string;
  note: string | null;
  createdAt: Date;
};

export async function listDataRequests(
  actor: SessionUser,
  filter: { status?: "pending" | "approved" | "rejected" | "completed" } = {},
): Promise<AdminDataRequest[]> {
  if (actor.role !== "admin") throw forbidden();
  const requester = aliasedTable(schema.user, "requester");
  const rows = await getDb()
    .select({
      id: schema.dataRequests.id,
      type: schema.dataRequests.type,
      status: schema.dataRequests.status,
      subjectUserId: schema.dataRequests.subjectUserId,
      subjectName: schema.user.name,
      subjectEmail: schema.user.email,
      subjectRole: schema.user.role,
      requestedByName: requester.name,
      note: schema.dataRequests.note,
      createdAt: schema.dataRequests.createdAt,
    })
    .from(schema.dataRequests)
    .innerJoin(schema.user, eq(schema.user.id, schema.dataRequests.subjectUserId))
    .innerJoin(requester, eq(requester.id, schema.dataRequests.requestedBy))
    .where(filter.status ? eq(schema.dataRequests.status, filter.status) : undefined)
    .orderBy(desc(schema.dataRequests.createdAt))
    .limit(200);
  return rows;
}

/**
 * Admin decision on a request. Approving a deletion hard-deletes the user (FK cascade
 * removes the app data); the audit entry keeps a minimal snapshot. Exports are already
 * approved on creation, so only deletions normally land here.
 */
export async function reviewDataRequest(
  actor: SessionUser,
  input: { requestId: string; decision: "approve" | "reject"; note?: string },
): Promise<void> {
  if (actor.role !== "admin") throw forbidden();
  const db = getDb();
  const req = await db.query.dataRequests.findFirst({ where: eq(schema.dataRequests.id, input.requestId) });
  if (!req) throw notFound();
  if (req.status !== "pending") throw new AppError("conflict", "already_reviewed");

  if (input.decision === "reject") {
    await db
      .update(schema.dataRequests)
      .set({ status: "rejected", reviewedBy: actor.id, note: input.note ?? null })
      .where(eq(schema.dataRequests.id, req.id));
    await audit({ actorId: actor.id, action: "data_request.reject", entity: "data_requests", entityId: req.id, after: { type: req.type, note: input.note ?? null } });
    return;
  }

  if (req.type === "export") {
    await db
      .update(schema.dataRequests)
      .set({ status: "approved", reviewedBy: actor.id, note: input.note ?? null })
      .where(eq(schema.dataRequests.id, req.id));
    await enqueueJob("data_export", { requestId: req.id }, { dedupeKey: `data_export:${req.id}` });
    await audit({ actorId: actor.id, action: "data_request.approve", entity: "data_requests", entityId: req.id, after: { type: "export" } });
    return;
  }

  // Hard deletion
  const subject = await db.query.user.findFirst({ where: eq(schema.user.id, req.subjectUserId) });
  if (!subject) throw notFound();
  if (subject.id === actor.id || subject.role === "admin") throw forbidden();
  if (subject.role === "parent") {
    // Refuse when it would orphan a child that has no other guardian.
    const kids = await db
      .select({ childId: schema.parentChildren.childId })
      .from(schema.parentChildren)
      .where(eq(schema.parentChildren.parentId, subject.id));
    if (kids.length) {
      const [others] = await db
        .select({ n: count() })
        .from(schema.parentChildren)
        .where(
          and(
            inArray(schema.parentChildren.childId, kids.map((k) => k.childId)),
            ne(schema.parentChildren.parentId, subject.id),
          ),
        );
      if ((others?.n ?? 0) < kids.length) throw new AppError("conflict", "parent_has_children");
    }
  }
  await audit({
    actorId: actor.id,
    action: "user.hard_delete",
    entity: "user",
    entityId: subject.id,
    before: { role: subject.role, email: subject.email, name: subject.name, isManagedChild: subject.isManagedChild, requestId: req.id },
  });
  await db.delete(schema.user).where(eq(schema.user.id, subject.id));
}
