import type { JobKind } from "@mufasa/db";
import type { WorkerContext } from "../context";

export type Job = { id: string; kind: JobKind; payload: Record<string, unknown>; attempts: number };
export type JobHandler = (job: Job, ctx: WorkerContext) => Promise<Record<string, unknown> | void>;

/**
 * Handler registry. Each module owns one file in this folder and registers it here:
 *   render_video, tts_project   → ./video.ts        (AI studio module)
 *   data_export                 → ./data-export.ts  (AI studio module, for the privacy flow)
 *   recitation_ai               → ./recitation-ai.ts (hifz module)
 *   certificate_pdf             → ./certificate.ts  (certificates module)
 *   email                       → ./email.ts        (optional)
 * Unregistered kinds fail permanently with a clear error.
 */
export const handlers: Partial<Record<JobKind, JobHandler>> = {};

export function register(kind: JobKind, handler: JobHandler) {
  handlers[kind] = handler;
}
