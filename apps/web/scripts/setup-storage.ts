/**
 * Creates the Supabase Storage buckets the app expects (idempotent).
 * Run once after connecting Supabase:   pnpm --filter web storage:setup
 * Bucket list mirrors src/server/storage.ts BUCKETS.
 */
import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(path.resolve(import.meta.dirname, "../../.."));

const BUCKETS: { name: string; public: boolean; fileSizeLimit: string; allowedMimeTypes?: string[] }[] = [
  { name: "public-assets", public: true, fileSizeLimit: "20MB" },
  { name: "avatars", public: true, fileSizeLimit: "2MB", allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"] },
  { name: "lesson-videos", public: false, fileSizeLimit: "2GB", allowedMimeTypes: ["video/mp4", "video/webm"] },
  { name: "lesson-assets", public: false, fileSizeLimit: "50MB" },
  { name: "receipts", public: false, fileSizeLimit: "10MB", allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"] },
  { name: "recitations", public: false, fileSizeLimit: "25MB" },
  { name: "tts-audio", public: false, fileSizeLimit: "50MB" },
  { name: "certificates", public: false, fileSizeLimit: "10MB", allowedMimeTypes: ["application/pdf"] },
  { name: "exports", public: false, fileSizeLimit: "200MB" },
];

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the root .env first (docs/supabase-setup.md).");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data: existing, error } = await supabase.storage.listBuckets();
if (error) throw error;
const have = new Set(existing.map((b) => b.name));

for (const b of BUCKETS) {
  const opts = { public: b.public, fileSizeLimit: b.fileSizeLimit, allowedMimeTypes: b.allowedMimeTypes };
  const res = have.has(b.name) ? await supabase.storage.updateBucket(b.name, opts) : await supabase.storage.createBucket(b.name, opts);
  if (res.error) {
    console.error(`x ${b.name}: ${res.error.message}`);
    process.exitCode = 1;
  } else {
    console.log(`${have.has(b.name) ? "updated" : "created"} ${b.name} (${b.public ? "public" : "private"})`);
  }
}
