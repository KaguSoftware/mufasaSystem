/**
 * AI Studio background jobs:
 *   tts_project   Gemini TTS per scene -> WAV in `tts-audio`, durations written back to the scene JSON.
 *   render_video  Remotion render of the scene JSON -> MP4 in `lesson-videos`.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { eq, schema } from "@mufasa/db";
import { sceneDocumentSchema, type SceneDocument } from "@mufasa/video/schema";
import { BUCKET, PermanentJobError, type WorkerContext } from "../context";
import { parsePcmMime, pcmDurationSec, pcmToWav } from "../lib/wav";
import { register, type Job } from "./index";

const ttsPayload = z.object({ projectId: z.string().uuid(), voice: z.string().min(1).max(40).optional() });
const renderPayload = z.object({ projectId: z.string().uuid() });

const DEFAULT_VOICE = "Kore";
const SIGNED_URL_TTL = 60 * 60 * 6;

async function loadProject(ctx: WorkerContext, projectId: string) {
  const [project] = await ctx.db.select().from(schema.videoProjects).where(eq(schema.videoProjects.id, projectId));
  if (!project) throw new PermanentJobError(`video project ${projectId} not found`);
  const parsed = sceneDocumentSchema.safeParse(project.sceneJson);
  if (!parsed.success) throw new PermanentJobError(`video project ${projectId} has no valid scene JSON`);
  return { project, doc: parsed.data };
}

async function setStatus(ctx: WorkerContext, projectId: string, status: (typeof schema.videoProjects.$inferSelect)["status"]) {
  await ctx.db.update(schema.videoProjects).set({ status }).where(eq(schema.videoProjects.id, projectId));
}

/** Prefix keeps the voice friendly without being read aloud (Gemini TTS treats "Say ...:" as a style cue). */
function ttsPrompt(doc: SceneDocument, narration: string) {
  const lang = { ar: "Arabic", en: "English", tr: "Turkish" }[doc.locale];
  return `Say in a warm, clear, friendly voice for children, at a calm teaching pace, in ${lang}: ${narration}`;
}

async function synthesize(ctx: WorkerContext, text: string, voice: string) {
  if (!ctx.gemini) throw new PermanentJobError("GEMINI_API_KEY is not configured on the worker");
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await ctx.gemini.models.generateContent({
        model: ctx.env.geminiTtsModel,
        contents: text,
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      });
      const inline = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
      if (!inline?.data) throw new Error("Gemini TTS returned no audio");
      const pcm = Buffer.from(inline.data, "base64");
      const fmt = parsePcmMime(inline.mimeType);
      return { wav: pcmToWav(pcm, fmt), durationSec: pcmDurationSec(pcm.byteLength, fmt) };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function ttsProjectInner(job: Job, ctx: WorkerContext) {
  const { projectId, voice: requested } = ttsPayload.parse(job.payload);
  if (!ctx.supabase) throw new PermanentJobError("Supabase storage is not configured on the worker");
  const { project, doc } = await loadProject(ctx, projectId);
  const voice = requested ?? project.voice ?? DEFAULT_VOICE;
  await ctx.db.update(schema.videoProjects).set({ status: "voicing", voice }).where(eq(schema.videoProjects.id, projectId));

  const audio: Record<string, { path: string; durationSec: number }> = {};
  const scenes = [...doc.scenes];
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]!;
    const { wav, durationSec } = await synthesize(ctx, ttsPrompt(doc, scene.narration), voice);
    const objectPath = `tts/${projectId}/${scene.id}.wav`;
    const { error } = await ctx.supabase.storage.from(BUCKET.ttsAudio).upload(objectPath, wav, {
      contentType: "audio/wav",
      upsert: true,
    });
    if (error) throw new Error(`upload ${objectPath} failed: ${error.message}`);
    const rounded = Math.round(durationSec * 100) / 100;
    audio[scene.id] = { path: objectPath, durationSec: rounded };
    // schema bounds: 1..120s
    scenes[i] = { ...scene, durationSec: Math.min(120, Math.max(1, rounded)) };
    await ctx.progress(((i + 1) / scenes.length) * 100);
    ctx.log(`scene ${scene.id}: ${rounded}s`);
  }

  await ctx.db
    .update(schema.videoProjects)
    .set({ audio, sceneJson: { ...doc, scenes }, status: "voiced" })
    .where(eq(schema.videoProjects.id, projectId));
  return { scenes: scenes.length, voice };
}

async function ttsProject(job: Job, ctx: WorkerContext) {
  try {
    return await ttsProjectInner(job, ctx);
  } catch (err) {
    const id = ttsPayload.safeParse(job.payload);
    if (id.success) await setStatus(ctx, id.data.projectId, "failed").catch(() => undefined);
    throw err;
  }
}

/** Resolves mascot pose art (stored paths) into absolute URLs. Empty map = built-in placeholder owl. */
async function mascotPoseUrls(ctx: WorkerContext, mascotId: string | null, slug: string): Promise<Record<string, string>> {
  const rows = mascotId
    ? await ctx.db.select().from(schema.mascots).where(eq(schema.mascots.id, mascotId))
    : await ctx.db.select().from(schema.mascots).where(eq(schema.mascots.slug, slug));
  const poses = rows[0]?.poses ?? {};
  const out: Record<string, string> = {};
  for (const [pose, p] of Object.entries(poses)) {
    if (/^https?:\/\//.test(p)) out[pose] = p;
    else if (p.startsWith("/")) out[pose] = `${ctx.env.appUrl}${p}`;
    else if (ctx.supabase) out[pose] = ctx.supabase.storage.from(BUCKET.publicAssets).getPublicUrl(p).data.publicUrl;
  }
  return out;
}

async function renderVideo(job: Job, ctx: WorkerContext) {
  const { projectId } = renderPayload.parse(job.payload);
  if (!ctx.supabase) throw new PermanentJobError("Supabase storage is not configured on the worker");
  const { project, doc } = await loadProject(ctx, projectId);
  await setStatus(ctx, projectId, "rendering");

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "mufasa-render-"));
  try {
    // Signed URLs so Chrome can stream the private clips during the render.
    const audio: Record<string, { src: string; durationSec: number }> = {};
    for (const scene of doc.scenes) {
      const clip = project.audio[scene.id];
      if (!clip) continue;
      const { data, error } = await ctx.supabase.storage.from(BUCKET.ttsAudio).createSignedUrl(clip.path, SIGNED_URL_TTL);
      if (error) throw new Error(`sign ${clip.path} failed: ${error.message}`);
      audio[scene.id] = { src: data.signedUrl, durationSec: clip.durationSec };
    }
    const mascotPoses = await mascotPoseUrls(ctx, project.mascotId, doc.mascot).catch(() => ({}));

    // Imported lazily so the worker boots fast and tests never load Chrome tooling.
    const { renderWhiteboard } = await import("../lib/render");
    const outFile = path.join(tmp, "out.mp4");
    const res = await renderWhiteboard({
      input: { doc, audio, assets: { mascotPoses } },
      outputLocation: outFile,
      log: ctx.log,
      onProgress: (pct) => void ctx.progress(pct * 0.95),
    });

    const objectPath = `videos/${projectId}/${Date.now()}.mp4`;
    const body = await fs.readFile(outFile);
    const { error } = await ctx.supabase.storage.from(BUCKET.lessonVideos).upload(objectPath, body, {
      contentType: "video/mp4",
      upsert: true,
    });
    if (error) throw new Error(`upload ${objectPath} failed: ${error.message}`);

    await ctx.db
      .update(schema.videoProjects)
      .set({ outputPath: objectPath, durationSec: Math.round(res.durationSec), status: "rendered" })
      .where(eq(schema.videoProjects.id, projectId));
    return { outputPath: objectPath, durationSec: res.durationSec, silentScenes: doc.scenes.length - Object.keys(audio).length };
  } catch (err) {
    await setStatus(ctx, projectId, "failed").catch(() => undefined);
    throw err;
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  }
}

register("tts_project", ttsProject);
register("render_video", renderVideo);
