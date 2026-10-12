import "server-only";
import { getDb, schema, sql, type JobKind } from "@mufasa/db";

/**
 * Enqueue background work for apps/render-worker. With a dedupeKey, enqueueing
 * the same logical job twice is a no-op while the first is still pending.
 */
export async function enqueueJob(
  kind: JobKind,
  payload: Record<string, unknown>,
  opts: { dedupeKey?: string; runAfter?: Date; maxAttempts?: number } = {},
) {
  const [row] = await getDb()
    .insert(schema.jobs)
    .values({
      kind,
      payload,
      dedupeKey: opts.dedupeKey,
      runAfter: opts.runAfter ?? new Date(),
      maxAttempts: opts.maxAttempts ?? 3,
    })
    .onConflictDoUpdate({
      target: schema.jobs.dedupeKey,
      // re-queue a finished/failed job with the same key; leave running ones alone
      set: { status: sql`case when ${schema.jobs.status} in ('queued','running') then ${schema.jobs.status} else 'queued' end`, payload, attempts: sql`case when ${schema.jobs.status} in ('queued','running') then ${schema.jobs.attempts} else 0 end`, error: null },
    })
    .returning({ id: schema.jobs.id, status: schema.jobs.status });
  return row!;
}
