import "server-only";
import type { Content } from "@google/genai";
import { eq, getDb, schema } from "@mufasa/db";
import { sceneDocumentJsonSchema, sceneDocumentSchema, type SceneDocument } from "@mufasa/video/schema";
import { AppError } from "../errors";
import { audit } from "../audit";
import { enqueueJob } from "../jobs";
import type { SessionUser } from "../session";
import * as studio from "../dal/studio";
import { gemini, models, sanitizeModelText } from "./gemini";
import {
  applyVerbatimAyahs,
  buildScenePrompt,
  buildSystemPrompt,
  cleanSceneDocument,
  collectAyahRefs,
  DEFAULT_VOICE_BY_LOCALE,
  ensureUniqueSceneIds,
  formatIssues,
  isStudioVoice,
  toGeminiSchema,
  type AgeBand,
} from "@/lib/ai-studio";

export { STUDIO_VOICES, DEFAULT_VOICE_BY_LOCALE } from "@/lib/ai-studio";

// ───────────── Chat (streaming) ─────────────

/**
 * Streams the model's reply as UTF-8 text chunks. The user message is stored before
 * the call and the model message after the stream ends (also when the client aborts,
 * so a partial answer is not lost). Token counts come from the final chunk's usage.
 */
export async function streamChatReply(
  actor: SessionUser,
  input: { conversationId: string; message: string; ageBand?: AgeBand },
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const client = gemini(); // throws integration_not_configured before we store anything
  const { conversation, history } = await studio.loadHistory(actor, input.conversationId);
  const lesson = await studio.getLessonPromptContext(conversation.lessonId, conversation.locale);
  const systemInstruction = buildSystemPrompt({
    lesson,
    extraContext: conversation.context,
    locale: conversation.locale as "ar" | "en" | "tr",
    ageBand: input.ageBand,
  });

  const userText = input.message.trim();
  await studio.appendMessage(conversation.id, "user", userText);
  const contents: Content[] = [...history, { role: "user" as const, content: userText }].map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  const stream = await client.models.generateContentStream({
    model: models.chat(),
    contents,
    config: { systemInstruction, abortSignal: signal },
  });

  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      let tokensIn: number | null = null;
      let tokensOut: number | null = null;
      try {
        for await (const chunk of stream) {
          const piece = chunk.text ?? "";
          if (piece) {
            full += piece;
            controller.enqueue(encoder.encode(sanitizeModelText(piece)));
          }
          const u = chunk.usageMetadata;
          if (u) {
            tokensIn = u.promptTokenCount ?? tokensIn;
            tokensOut = u.candidatesTokenCount ?? tokensOut;
          }
        }
        controller.close();
      } catch (err) {
        if (signal?.aborted) controller.close();
        else controller.error(err);
      } finally {
        if (full.trim()) {
          await studio.appendMessage(conversation.id, "model", sanitizeModelText(full), { tokensIn, tokensOut }).catch((e) => {
            console.error("[ai-studio] failed to persist model message", e);
          });
        }
      }
    },
  });
}

// ───────────── Scenes ─────────────

async function askForScenes(
  systemInstruction: string,
  scriptText: string,
  previous?: { raw: string; errors: string },
): Promise<string> {
  const contents: Content[] = [{ role: "user", parts: [{ text: `APPROVED SCRIPT:\n\n${scriptText}` }] }];
  if (previous) {
    contents.push({ role: "model", parts: [{ text: previous.raw }] });
    contents.push({
      role: "user",
      parts: [{ text: `That JSON failed validation. Fix every problem and return the complete corrected JSON only.\n\n${previous.errors}` }],
    });
  }
  const res = await gemini().models.generateContent({
    model: models.chat(),
    contents,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseJsonSchema: toGeminiSchema(sceneDocumentJsonSchema()),
      temperature: 0.6,
    },
  });
  const text = res.text;
  if (!text) throw new AppError("internal", "Gemini returned an empty scene document");
  return text;
}

function tryParse(raw: string): { ok: true; data: SceneDocument } | { ok: false; errors: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    return { ok: false, errors: `Not valid JSON: ${(err as Error).message}` };
  }
  const res = sceneDocumentSchema.safeParse(json);
  return res.success ? { ok: true, data: res.data } : { ok: false, errors: formatIssues(res.error) };
}

/**
 * Approved script -> scene JSON. Structured output, zod validation with one repair
 * retry, Quranic text replaced from the database, em dashes stripped.
 * Creates a project, or regenerates into `projectId` when given.
 */
export async function generateScenes(
  actor: SessionUser,
  scriptId: string,
  projectId?: string,
): Promise<{ projectId: string; warnings: string[] }> {
  const script = await studio.getScriptOwned(actor, scriptId);
  if (script.status !== "approved") throw new AppError("conflict", "Approve the script before generating scenes.");
  const project = projectId ? await studio.getProjectOwned(actor, projectId) : null;
  if (project && (project.status === "voicing" || project.status === "rendering")) {
    throw new AppError("conflict", "A job is running for this project.");
  }

  const locale = script.locale as "ar" | "en" | "tr";
  const lesson = await studio.getLessonPromptContext(script.lessonId, locale);
  const conversation = script.conversationId ? await studio.getConversationOwned(actor, script.conversationId).catch(() => null) : null;
  const system = buildScenePrompt({ locale, lesson, extraContext: conversation?.context });

  let raw = await askForScenes(system, script.content);
  let parsed = tryParse(raw);
  if (!parsed.ok) {
    raw = await askForScenes(system, script.content, { raw, errors: parsed.errors });
    parsed = tryParse(raw);
  }
  if (!parsed.ok) throw new AppError("validation", "Gemini produced an invalid scene document twice. Try again or simplify the script.");

  let doc = ensureUniqueSceneIds({ ...parsed.data, locale });
  const lookup = await studio.lookupAyahs(collectAyahRefs(doc));
  const withAyat = applyVerbatimAyahs(doc, lookup);
  doc = cleanSceneDocument(withAyat.doc, sanitizeModelText);

  const target = project ?? (await studio.createProject(actor, script));
  await getDb()
    .update(schema.videoProjects)
    .set({ sceneJson: doc, audio: {}, status: "scenes_ready", outputPath: null, durationSec: null, scriptId: script.id, locale })
    .where(eq(schema.videoProjects.id, target.id));
  return { projectId: target.id, warnings: withAyat.warnings };
}

// ───────────── Voice, render, publish ─────────────

export async function voiceProject(actor: SessionUser, projectId: string, voice?: string) {
  const project = await studio.getProjectOwned(actor, projectId);
  if (!project.sceneJson) throw new AppError("conflict", "Generate the scenes first.");
  if (project.status === "voicing" || project.status === "rendering") throw new AppError("conflict", "A job is already running.");
  const chosen = voice ?? project.voice ?? DEFAULT_VOICE_BY_LOCALE[project.locale as "ar" | "en" | "tr"] ?? "Kore";
  if (!isStudioVoice(chosen)) throw new AppError("validation", "Unknown voice", { voice: ["unknown"] });
  const job = await enqueueJob("tts_project", { projectId, voice: chosen }, { dedupeKey: `tts_project:${projectId}` });
  await getDb().update(schema.videoProjects).set({ status: "voicing", voice: chosen }).where(eq(schema.videoProjects.id, projectId));
  return { jobId: job.id };
}

/**
 * Rendering needs a voice clip for every scene. A silent render (default scene
 * lengths, no narration) is possible only when the caller passes `allowSilent`.
 */
export async function renderProject(actor: SessionUser, projectId: string, opts: { allowSilent?: boolean } = {}) {
  const project = await studio.getProjectOwned(actor, projectId);
  const parsed = sceneDocumentSchema.safeParse(project.sceneJson);
  if (!parsed.success) throw new AppError("conflict", "Generate the scenes first.");
  if (project.status === "voicing" || project.status === "rendering") throw new AppError("conflict", "A job is already running.");
  const missing = parsed.data.scenes.filter((s) => !project.audio[s.id]);
  if (missing.length && !opts.allowSilent) throw new AppError("conflict", "Voice is missing for some scenes.", { scenes: missing.map((s) => s.id) });
  const job = await enqueueJob("render_video", { projectId }, { dedupeKey: `render_video:${projectId}` });
  await getDb().update(schema.videoProjects).set({ status: "rendering" }).where(eq(schema.videoProjects.id, projectId));
  return { jobId: job.id, silentScenes: missing.length };
}

/**
 * Points the lesson at the rendered MP4. Both live in the `lesson-videos` bucket, so
 * the lesson references the same object (no copy); the lesson page signs it on view.
 */
export async function publishProject(actor: SessionUser, projectId: string) {
  const project = await studio.getProjectOwned(actor, projectId);
  if (!project.lessonId) throw new AppError("conflict", "Link the project to a lesson first.");
  if (!project.outputPath || (project.status !== "rendered" && project.status !== "published")) {
    throw new AppError("conflict", "Render the video before publishing.");
  }
  const db = getDb();
  const [before] = await db
    .select({ videoPath: schema.lessons.videoPath, videoDurationSec: schema.lessons.videoDurationSec })
    .from(schema.lessons)
    .where(eq(schema.lessons.id, project.lessonId));
  if (!before) throw new AppError("not_found");
  await db
    .update(schema.lessons)
    .set({ videoPath: project.outputPath, videoDurationSec: project.durationSec })
    .where(eq(schema.lessons.id, project.lessonId));
  await db.update(schema.videoProjects).set({ status: "published" }).where(eq(schema.videoProjects.id, projectId));
  await audit({
    actorId: actor.id,
    action: "studio.publish",
    entity: "lessons",
    entityId: project.lessonId,
    before,
    after: { videoPath: project.outputPath, videoDurationSec: project.durationSec },
  });
  return { lessonId: project.lessonId };
}
