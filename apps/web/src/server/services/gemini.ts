import "server-only";
import { GoogleGenAI } from "@google/genai";
import { env, isConfigured } from "@/env";
import { AppError } from "../errors";

/**
 * Shared Gemini client. Feature modules build on this:
 *  - AI Studio chat + scene JSON + TTS (services/ai-studio.ts)
 *  - recitation feedback (worker, see apps/render-worker)
 * Model ids come from env so they can be bumped without code changes.
 */
let client: GoogleGenAI | null = null;

export function gemini(): GoogleGenAI {
  if (!isConfigured("gemini")) throw new AppError("integration_not_configured", "Gemini");
  client ??= new GoogleGenAI({ apiKey: env().GEMINI_API_KEY! });
  return client;
}

export const models = {
  chat: () => env().GEMINI_CHAT_MODEL,
  fast: () => env().GEMINI_FAST_MODEL,
  tts: () => env().GEMINI_TTS_MODEL,
};

/**
 * House style appended to every system prompt that produces learner-facing text.
 * The no-em-dash rule is a hard project requirement.
 */
export const HOUSE_STYLE = [
  "Audience: children and teenagers (roughly 5 to 17) learning Arabic and the Quran.",
  "Tone: warm, encouraging, simple sentences, age-appropriate, respectful of Islamic adab.",
  "Never invent or paraphrase Quranic text; only use ayah text that is provided to you verbatim.",
  "Never use the em dash character (U+2014). Use commas, colons, periods or parentheses instead.",
].join("\n");

/** Defensive post-processing for any model text we store or show. */
const EM_DASH = new RegExp(`\\s*${String.fromCharCode(0x2014)}\\s*`, "g");

export function sanitizeModelText(text: string): string {
  return text.replace(EM_DASH, ", ");
}
