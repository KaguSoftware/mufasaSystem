/**
 * Scene document: the contract between Gemini (which writes it via structured
 * output), the AI Studio editor (which lets tutors tweak it) and the Remotion
 * renderer (which draws it). Change it here and all three follow.
 *
 * Coordinates are percentages of the board (0..100), so layouts are
 * resolution-independent. Timings are seconds relative to the scene start.
 */
import { z } from "zod";

export const MASCOT_POSES = ["idle", "talk", "point", "think", "celebrate", "wave", "write"] as const;
export const BOARD_COLORS = ["ink", "blue", "red", "green", "orange", "purple"] as const;
export const TEXT_SIZES = ["sm", "md", "lg", "xl", "xxl"] as const;

const pct = z.number().min(0).max(100);
const at = z.number().min(0).describe("Seconds after scene start when this action begins");

const base = {
  id: z.string().min(1).max(40).optional().describe("Stable id so later actions (highlight/erase) can target it"),
  at,
  durationSec: z.number().min(0.1).max(30).optional().describe("How long the draw/write animation takes"),
};

export const writeAction = z.object({
  type: z.literal("write"),
  ...base,
  text: z.string().min(1).max(200),
  x: pct,
  y: pct,
  size: z.enum(TEXT_SIZES).default("md"),
  color: z.enum(BOARD_COLORS).default("ink"),
  font: z.enum(["naskh", "sans", "hand"]).default("hand").describe("naskh for Arabic/Quranic text"),
  dir: z.enum(["rtl", "ltr", "auto"]).default("auto"),
  align: z.enum(["start", "center", "end"]).default("center"),
});

export const drawAction = z.object({
  type: z.literal("draw"),
  ...base,
  shape: z.enum(["arrow", "line", "circle", "rect", "underline", "check", "cross", "star", "bracket"]),
  x: pct,
  y: pct,
  w: pct,
  h: pct,
  color: z.enum(BOARD_COLORS).default("ink"),
  flip: z.boolean().default(false).describe("Mirror horizontally: arrows and lines run top-right to bottom-left, brackets become ]"),
});

/** Shows an Arabic letter with its positional forms: core of early lessons. */
export const letterAction = z.object({
  type: z.literal("letter"),
  ...base,
  letter: z.string().min(1).max(2),
  showForms: z.boolean().default(true).describe("Show isolated, initial, medial and final forms"),
  x: pct,
  y: pct,
  color: z.enum(BOARD_COLORS).default("ink"),
});

/** Quranic text. Renderer uses the provided text verbatim (never AI-paraphrased). */
export const ayahAction = z.object({
  type: z.literal("ayah"),
  ...base,
  surah: z.number().int().min(1).max(114),
  ayah: z.number().int().min(1).max(286),
  text: z.string().min(1).max(1200).describe("Exact Uthmani text, filled from the database, not generated"),
  x: pct,
  y: pct,
  size: z.enum(TEXT_SIZES).default("lg"),
});

export const imageAction = z.object({
  type: z.literal("image"),
  ...base,
  src: z.string().min(1).describe("Asset key from the asset library, e.g. 'apple'"),
  x: pct,
  y: pct,
  w: pct,
  h: pct,
});

export const highlightAction = z.object({
  type: z.literal("highlight"),
  at,
  targetId: z.string(),
  color: z.enum(BOARD_COLORS).default("orange"),
  style: z.enum(["marker", "circle", "underline", "pulse"]).default("marker"),
});

export const eraseAction = z.object({
  type: z.literal("erase"),
  at,
  /** Omit to clear the whole board. */
  targetId: z.string().optional(),
});

export const boardAction = z.discriminatedUnion("type", [
  writeAction,
  drawAction,
  letterAction,
  ayahAction,
  imageAction,
  highlightAction,
  eraseAction,
]);

export const sceneSchema = z.object({
  id: z.string().min(1).max(40),
  narration: z.string().min(1).max(1500).describe("Exactly what the mascot says (sent to TTS)"),
  /** Filled after TTS; renderer uses audio length when present. */
  durationSec: z.number().min(1).max(120).optional(),
  mascot: z.object({
    pose: z.enum(MASCOT_POSES).default("talk"),
    position: z.enum(["left", "right", "hidden"]).default("left"),
  }),
  clearBoardBefore: z.boolean().default(false),
  actions: z.array(boardAction).max(30).default([]),
});

export const sceneDocumentSchema = z.object({
  version: z.literal(1).default(1),
  title: z.string().min(1).max(200),
  locale: z.enum(["ar", "en", "tr"]),
  mascot: z.string().default("default").describe("Mascot slug"),
  board: z.enum(["whiteboard", "chalkboard", "grid"]).default("whiteboard"),
  scenes: z.array(sceneSchema).min(1).max(60),
});

export type BoardAction = z.infer<typeof boardAction>;
export type Scene = z.infer<typeof sceneSchema>;
export type SceneDocument = z.infer<typeof sceneDocumentSchema>;
export type SceneDocumentInput = z.input<typeof sceneDocumentSchema>;

export const VIDEO = { fps: 30, width: 1920, height: 1080, defaultSceneSec: 6, tailSec: 0.6 } as const;

/** Scene length in seconds: TTS audio length if known, else action span, else default. */
export function sceneDuration(scene: Scene): number {
  if (scene.durationSec) return scene.durationSec + VIDEO.tailSec;
  const lastAction = scene.actions.reduce((m, a) => {
    const d = "durationSec" in a && a.durationSec ? a.durationSec : 1;
    return Math.max(m, a.at + d);
  }, 0);
  return Math.max(VIDEO.defaultSceneSec, lastAction + 1);
}

export function totalDurationInFrames(doc: SceneDocument): number {
  return doc.scenes.reduce((sum, s) => sum + Math.round(sceneDuration(s) * VIDEO.fps), 0);
}

/** JSON Schema for Gemini `responseJsonSchema` (structured output). */
export function sceneDocumentJsonSchema() {
  return z.toJSONSchema(sceneDocumentSchema, { target: "draft-7", io: "input" });
}
