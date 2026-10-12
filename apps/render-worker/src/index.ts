/**
 * Render worker: a long-running Node process (not serverless; Remotion needs
 * Chrome + ffmpeg). Polls the `jobs` table with FOR UPDATE SKIP LOCKED,
 * runs the registered handler, records progress/result, retries with backoff.
 *
 *   pnpm worker            # from repo root
 *
 * Deploy anywhere that runs a container (Railway, Fly.io, a VPS). See docs/ai-video-pipeline.md.
 */
import { eq, schema, sql } from "@mufasa/db";
import { baseContext, PermanentJobError, type WorkerContext } from "./context";
import { handlers, type Job } from "./handlers";
import "./handlers/register";

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 3000);
const STALE_LOCK_MIN = 30;

const base = baseContext();
const db = base.db;
let stopping = false;

async function claim(): Promise<Job | null> {
  // Re-queue jobs whose worker died mid-run.
  await db.execute(sql`
    update jobs set status = 'queued', locked_at = null, locked_by = null
    where status = 'running' and locked_at < now() - make_interval(mins => ${STALE_LOCK_MIN}::int)
  `);
  const rows = await db.execute<{ id: string; kind: Job["kind"]; payload: Record<string, unknown>; attempts: number }>(sql`
    update jobs set status = 'running', locked_at = now(), locked_by = ${base.workerId}, attempts = attempts + 1, updated_at = now()
    where id = (
      select id from jobs
      where status = 'queued' and run_after <= now()
      order by run_after
      limit 1
      for update skip locked
    )
    returning id, kind, payload, attempts
  `);
  return rows[0] ?? null;
}

async function finish(job: Job, result: Record<string, unknown> | void) {
  await db
    .update(schema.jobs)
    .set({ status: "succeeded", progress: 100, result: result ?? {}, lockedAt: null, error: null })
    .where(eq(schema.jobs.id, job.id));
}

async function fail(job: Job, err: unknown) {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const [row] = await db.select({ max: schema.jobs.maxAttempts }).from(schema.jobs).where(eq(schema.jobs.id, job.id));
  const permanent = err instanceof PermanentJobError || job.attempts >= (row?.max ?? 3);
  const backoffSec = Math.min(60 * 30, 30 * 2 ** job.attempts);
  await db
    .update(schema.jobs)
    .set({
      status: permanent ? "failed" : "queued",
      error: message.slice(0, 4000),
      lockedAt: null,
      lockedBy: null,
      runAfter: permanent ? undefined : new Date(Date.now() + backoffSec * 1000),
    })
    .where(eq(schema.jobs.id, job.id));
  console.error(`[worker] job ${job.id} (${job.kind}) ${permanent ? "failed" : "will retry"}: ${message}`);
}

async function runOne(job: Job) {
  const handler = handlers[job.kind];
  const ctx: WorkerContext = {
    ...base,
    log: (...a) => console.log(`[${job.kind}:${job.id.slice(0, 8)}]`, ...a),
    progress: async (pct) => {
      await db
        .update(schema.jobs)
        .set({ progress: Math.max(0, Math.min(99, Math.round(pct))) })
        .where(eq(schema.jobs.id, job.id));
    },
  };
  try {
    if (!handler) throw new PermanentJobError(`No handler registered for job kind "${job.kind}"`);
    const result = await handler(job, ctx);
    await finish(job, result);
    ctx.log("done");
  } catch (err) {
    await fail(job, err);
  }
}

async function loop() {
  console.log(`[worker] ${base.workerId} started. Handlers: ${Object.keys(handlers).join(", ") || "(none)"}`);
  while (!stopping) {
    let job: Job | null = null;
    try {
      job = await claim();
    } catch (err) {
      console.error("[worker] claim failed", err);
    }
    if (job) await runOne(job);
    else await new Promise((r) => setTimeout(r, POLL_MS));
  }
  console.log("[worker] stopped");
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    stopping = true;
  });
}

if (!process.env.DATABASE_URL) {
  console.error("[worker] DATABASE_URL is not set. See docs/supabase-setup.md");
  process.exit(1);
}

void loop();
