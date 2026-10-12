import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getDb, type Db } from "@mufasa/db";

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, "../../../.env") });

/** Everything a job handler needs. Built once per worker process. */
export type WorkerContext = {
  db: Db;
  /** Null when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing. */
  supabase: SupabaseClient | null;
  /** Null when GEMINI_API_KEY is missing. */
  gemini: GoogleGenAI | null;
  env: {
    geminiChatModel: string;
    geminiFastModel: string;
    geminiTtsModel: string;
    appUrl: string;
  };
  workerId: string;
  /** Report 0..100 progress for the running job (shown in the UI). */
  progress: (pct: number) => Promise<void>;
  log: (...args: unknown[]) => void;
};

export function baseContext(): Omit<WorkerContext, "progress" | "log"> {
  const e = process.env;
  return {
    db: getDb(),
    supabase:
      e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY
        ? createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
        : null,
    gemini: e.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: e.GEMINI_API_KEY }) : null,
    env: {
      geminiChatModel: e.GEMINI_CHAT_MODEL || "gemini-2.5-pro",
      geminiFastModel: e.GEMINI_FAST_MODEL || "gemini-2.5-flash",
      geminiTtsModel: e.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts",
      appUrl: e.APP_URL || "http://localhost:3000",
    },
    workerId: `${process.env.HOSTNAME ?? "worker"}-${process.pid}`,
  };
}

/** Bucket names mirror apps/web/src/server/storage.ts BUCKETS. */
export const BUCKET = {
  publicAssets: "public-assets",
  lessonVideos: "lesson-videos",
  recitations: "recitations",
  ttsAudio: "tts-audio",
  certificates: "certificates",
  exports: "exports",
} as const;

export class PermanentJobError extends Error {
  /** Throw this for failures that retrying cannot fix (bad input, missing config). */
  constructor(message: string) {
    super(message);
    this.name = "PermanentJobError";
  }
}
