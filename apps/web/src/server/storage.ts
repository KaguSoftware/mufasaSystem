import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isConfigured } from "@/env";
import { AppError } from "./errors";

/**
 * Buckets. Private ones are only ever served via short-lived signed URLs after
 * a DAL authorization check. Create them with `pnpm --filter web storage:setup`
 * (scripts/setup-storage.ts) once Supabase is connected.
 */
export const BUCKETS = {
  publicAssets: { name: "public-assets", public: true },
  avatars: { name: "avatars", public: true },
  lessonVideos: { name: "lesson-videos", public: false },
  lessonAssets: { name: "lesson-assets", public: false },
  receipts: { name: "receipts", public: false },
  recitations: { name: "recitations", public: false },
  ttsAudio: { name: "tts-audio", public: false },
  certificates: { name: "certificates", public: false },
  exports: { name: "exports", public: false },
} as const;

export type BucketKey = keyof typeof BUCKETS;

/** Storage abstraction, so swapping Supabase for S3/R2/Bunny is one file. */
export interface StorageAdapter {
  upload(bucket: BucketKey, path: string, body: Blob | ArrayBuffer | Uint8Array, contentType: string): Promise<string>;
  signedUrl(bucket: BucketKey, path: string, expiresInSec?: number): Promise<string>;
  signedUploadUrl(bucket: BucketKey, path: string): Promise<{ url: string; token: string; path: string }>;
  publicUrl(bucket: BucketKey, path: string): string;
  download(bucket: BucketKey, path: string): Promise<Blob>;
  remove(bucket: BucketKey, paths: string[]): Promise<void>;
}

class SupabaseStorage implements StorageAdapter {
  constructor(private client: SupabaseClient) {}

  private b(bucket: BucketKey) {
    return this.client.storage.from(BUCKETS[bucket].name);
  }

  async upload(bucket: BucketKey, path: string, body: Blob | ArrayBuffer | Uint8Array, contentType: string) {
    const { data, error } = await this.b(bucket).upload(path, body, { contentType, upsert: true });
    if (error) throw new Error(`storage upload failed: ${error.message}`);
    return data.path;
  }

  async signedUrl(bucket: BucketKey, path: string, expiresInSec = 60 * 60) {
    const { data, error } = await this.b(bucket).createSignedUrl(path, expiresInSec);
    if (error) throw new Error(`storage sign failed: ${error.message}`);
    return data.signedUrl;
  }

  async signedUploadUrl(bucket: BucketKey, path: string) {
    const { data, error } = await this.b(bucket).createSignedUploadUrl(path, { upsert: true });
    if (error) throw new Error(`storage sign upload failed: ${error.message}`);
    return { url: data.signedUrl, token: data.token, path: data.path };
  }

  publicUrl(bucket: BucketKey, path: string) {
    return this.b(bucket).getPublicUrl(path).data.publicUrl;
  }

  async download(bucket: BucketKey, path: string) {
    const { data, error } = await this.b(bucket).download(path);
    if (error) throw new Error(`storage download failed: ${error.message}`);
    return data;
  }

  async remove(bucket: BucketKey, paths: string[]) {
    const { error } = await this.b(bucket).remove(paths);
    if (error) throw new Error(`storage remove failed: ${error.message}`);
  }
}

let instance: StorageAdapter | null = null;

export function storage(): StorageAdapter {
  if (instance) return instance;
  if (!isConfigured("storage")) throw new AppError("integration_not_configured", "Supabase Storage");
  const e = env();
  instance = new SupabaseStorage(
    createClient(e.SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }),
  );
  return instance;
}

/** Build a collision-free object path: <prefix>/<yyyy>/<mm>/<uuid>.<ext> */
export function objectPath(prefix: string, ext: string) {
  const d = new Date();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${prefix}/${d.getUTCFullYear()}/${mm}/${crypto.randomUUID()}.${ext.replace(/^\./, "")}`;
}
