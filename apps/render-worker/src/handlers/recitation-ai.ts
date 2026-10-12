import { and, asc, eq, gte, lte, schema } from "@mufasa/db";
import type { AiTajweedNote, AiWordIssue } from "@mufasa/db/schema";
import { BUCKET, PermanentJobError } from "../context";
import { alignWords, diffIssues, wordAccuracy } from "../lib/word-diff";
import { register, type JobHandler } from "./index";

/**
 * recitation_ai: advisory AI feedback on a student's recitation.
 * 1. download the audio, 2. ask Gemini for a transcript + tajweed notes (structured JSON),
 * 3. compute a DETERMINISTIC accuracy with a word diff against the expected ayah text.
 * The tutor's grade is authoritative; this is only a helper.
 */

const EM_DASH = new RegExp(`\\s*${String.fromCharCode(0x2014)}\\s*`, "g");
const clean = (s: string) => s.replace(EM_DASH, ", ").trim();

const LANG_NAME: Record<string, string> = { en: "English", ar: "Arabic", tr: "Turkish" };

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    transcript: { type: "string", description: "What the student actually recited, in Arabic script, as heard." },
    wordIssues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer", description: "0-based index of the expected word" },
          expected: { type: "string" },
          heard: { type: "string" },
          kind: { type: "string", enum: ["missing", "extra", "mispronounced"] },
        },
        required: ["index", "kind"],
      },
    },
    tajweedNotes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rule: { type: "string", enum: ["madd", "ghunnah", "qalqalah", "idgham", "ikhfa", "izhar", "iqlab", "other"] },
          word: { type: "string" },
          note: { type: "string" },
          severity: { type: "string", enum: ["info", "minor", "major"] },
        },
        required: ["rule", "note", "severity"],
      },
    },
    summary: { type: "string" },
    confidence: { type: "number", description: "0 to 1" },
  },
  required: ["transcript", "wordIssues", "tajweedNotes", "summary", "confidence"],
} as const;

type ModelOutput = {
  transcript: string;
  wordIssues?: AiWordIssue[];
  tajweedNotes?: AiTajweedNote[];
  summary: string;
  confidence?: number;
};

const MAX_ATTEMPTS = 3;

export const recitationAi: JobHandler = async (job, ctx) => {
  const recitationId = String(job.payload.recitationId ?? "");
  if (!recitationId) throw new PermanentJobError("recitation_ai: payload.recitationId is required");
  if (!ctx.supabase) throw new PermanentJobError("Supabase Storage is not configured");
  if (!ctx.gemini) throw new PermanentJobError("Gemini is not configured (GEMINI_API_KEY)");

  const db = ctx.db;
  const [sub] = await db.select().from(schema.recitationSubmissions).where(eq(schema.recitationSubmissions.id, recitationId));
  if (!sub) throw new PermanentJobError(`recitation ${recitationId} not found`);

  await db
    .insert(schema.recitationAiFeedback)
    .values({ recitationId, status: "processing" })
    .onConflictDoUpdate({ target: schema.recitationAiFeedback.recitationId, set: { status: "processing", error: null } });

  try {
    await ctx.progress(10);
    const [student] = await db
      .select({ locale: schema.user.locale })
      .from(schema.user)
      .where(eq(schema.user.id, sub.studentId));
    const locale = student?.locale && LANG_NAME[student.locale] ? student.locale : "en";

    const ayahs = await db
      .select()
      .from(schema.quranAyahs)
      .where(
        and(
          eq(schema.quranAyahs.surah, sub.surah),
          gte(schema.quranAyahs.ayah, sub.ayahFrom),
          lte(schema.quranAyahs.ayah, sub.ayahTo),
        ),
      )
      .orderBy(asc(schema.quranAyahs.ayah));
    if (!ayahs.length) throw new PermanentJobError("Quran text is not seeded for this range");
    const expectedUthmani = ayahs.map((a) => a.textUthmani).join(" ");
    const expectedSimple = ayahs.map((a) => a.textSimple).join(" ");

    const { data: file, error: dlError } = await ctx.supabase.storage.from(BUCKET.recitations).download(sub.audioPath);
    if (dlError || !file) throw new Error(`audio download failed: ${dlError?.message ?? "empty"}`);
    const bytes = Buffer.from(await file.arrayBuffer());
    const mimeType = (file.type || "audio/webm").split(";")[0]!;
    await ctx.progress(30);

    const model = ctx.env.geminiFastModel || ctx.env.geminiChatModel;
    const prompt = [
      "You are a careful Quran recitation (tajweed) assistant helping a tutor review a child or teen student.",
      `The student was asked to recite surah ${sub.surah}, ayah ${sub.ayahFrom} to ${sub.ayahTo}. The expected text, verbatim:`,
      expectedUthmani,
      "",
      "Listen to the audio and:",
      "1. Write the transcript of what was actually recited, in Arabic script (do not just copy the expected text; transcribe what you hear).",
      "2. List word issues against the expected text: missing words, extra words, mispronounced words. index is the 0-based index of the expected word.",
      "3. List tajweed observations (madd, ghunnah, qalqalah, idgham, ikhfa, izhar, iqlab, other) with a short note and severity (info, minor, major). Only mention things you are reasonably sure about.",
      `4. Write a short, kind, encouraging summary (2 to 3 simple sentences) in ${LANG_NAME[locale]} for the student. Start with something positive, then name at most two things to practice.`,
      "5. Give your confidence from 0 to 1. If the audio is unclear or silent, say so and use a low confidence.",
      "",
      "You are only an assistant: the human tutor decides the grade. Never invent Quranic text. Never use the em dash character (U+2014); use commas, colons or periods.",
    ].join("\n");

    const res = await ctx.gemini.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [{ inlineData: { mimeType, data: bytes.toString("base64") } }, { text: prompt }],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_SCHEMA,
        temperature: 0.2,
      },
    });
    await ctx.progress(75);

    const raw = res.text;
    if (!raw) throw new Error("Gemini returned no text");
    let out: ModelOutput;
    try {
      out = JSON.parse(raw) as ModelOutput;
    } catch {
      throw new Error("Gemini returned invalid JSON");
    }

    // Deterministic accuracy: word diff of the transcript against the expected simple text.
    const transcript = clean(out.transcript ?? "");
    const ops = alignWords(expectedSimple, transcript);
    const accuracy = transcript ? wordAccuracy(ops) : 0;
    const diff = diffIssues(ops);
    const flagged = new Set(diff.map((d) => d.index));
    // Keep model-reported mispronunciations the transcript diff cannot see (it only sees letters).
    const modelExtra = (out.wordIssues ?? []).filter((w) => w.kind === "mispronounced" && !flagged.has(w.index));
    const wordIssues: AiWordIssue[] = [...diff, ...modelExtra].sort((a, b) => a.index - b.index);

    const tajweedNotes: AiTajweedNote[] = (out.tajweedNotes ?? []).slice(0, 20).map((n) => ({
      rule: n.rule,
      word: n.word,
      note: clean(n.note ?? ""),
      severity: n.severity,
    }));
    const confidence = Math.max(0, Math.min(1, Number(out.confidence ?? 0)));

    await db
      .update(schema.recitationAiFeedback)
      .set({
        status: "done",
        model,
        transcript,
        accuracy,
        wordIssues,
        tajweedNotes,
        summary: clean(out.summary ?? ""),
        confidence,
        error: null,
      })
      .where(eq(schema.recitationAiFeedback.recitationId, recitationId));
    return { recitationId, accuracy };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const final = err instanceof PermanentJobError || job.attempts >= MAX_ATTEMPTS;
    await db
      .update(schema.recitationAiFeedback)
      .set({ status: final ? "failed" : "queued", error: message.slice(0, 1000) })
      .where(eq(schema.recitationAiFeedback.recitationId, recitationId));
    throw err;
  }
};

register("recitation_ai", recitationAi);
