/**
 * Pure helpers for the AI Studio: prompts, voices, Gemini schema massaging and
 * scene document post-processing. No DB / network here so everything is testable.
 */
import type { z } from "zod";
import { BOARD_COLORS, MASCOT_POSES, TEXT_SIZES, type BoardAction, type SceneDocument } from "@mufasa/video/schema";
import { HOUSE_STYLE } from "@/server/services/gemini";
import type { AgeBand } from "./studio-voices";

export { AGE_BANDS, DEFAULT_VOICE_BY_LOCALE, STUDIO_VOICES, isStudioVoice, type AgeBand, type StudioVoice } from "./studio-voices";

// ───────────── Prompts ─────────────

const LANGUAGE_NAME = { ar: "Arabic (Modern Standard, simple and clear)", en: "English", tr: "Turkish" } as const;

export type LessonPromptContext = {
  title: string;
  summary?: string | null;
  objectives?: string[];
  approach?: string;
  vocabulary?: { term: string; meaning?: string }[];
  notes?: string;
  /** Verbatim ayahs from the database. */
  ayahs?: { surah: number; ayah: number; text: string }[];
};

export function describeLesson(lesson: LessonPromptContext | null, extraContext?: string | null): string {
  const lines: string[] = [];
  if (lesson) {
    lines.push(`Lesson title: ${lesson.title}`);
    if (lesson.summary) lines.push(`Summary: ${lesson.summary}`);
    if (lesson.objectives?.length) lines.push(`Objectives:\n${lesson.objectives.map((o) => `- ${o}`).join("\n")}`);
    if (lesson.approach) lines.push(`Teaching approach: ${lesson.approach}`);
    if (lesson.vocabulary?.length)
      lines.push(`Vocabulary:\n${lesson.vocabulary.map((v) => `- ${v.term}${v.meaning ? `: ${v.meaning}` : ""}`).join("\n")}`);
    if (lesson.ayahs?.length)
      lines.push(
        `Ayat for this lesson (verbatim from the database, never alter them):\n${lesson.ayahs
          .map((a) => `- [${a.surah}:${a.ayah}] ${a.text}`)
          .join("\n")}`,
      );
    if (lesson.notes) lines.push(`Tutor notes: ${lesson.notes}`);
  }
  if (extraContext?.trim()) lines.push(`Extra context from the tutor:\n${extraContext.trim()}`);
  return lines.length ? lines.join("\n\n") : "(The tutor has not provided any lesson context yet. Ask what the lesson is about.)";
}

const ACTION_VOCABULARY = [
  "write: handwrite text on the board (Arabic uses the Naskh font, other text a hand font).",
  "draw: arrow, line, circle, rect, underline, check, cross, star or bracket shapes.",
  "letter: show one Arabic letter big, optionally with its isolated, initial, medial and final forms.",
  "ayah: show a Quranic verse (by surah and ayah number; the exact text is inserted by the system).",
  `image: show a small built-in picture. Available keys: apple, book, star, house, cat, sun, moon, mosque, pen, heart.`,
  "highlight: draw attention to something already on the board (marker, circle, underline or pulse).",
  "erase: fade out one element or the whole board.",
].join("\n");

export function buildSystemPrompt(opts: {
  lesson: LessonPromptContext | null;
  extraContext?: string | null;
  locale: "ar" | "en" | "tr";
  ageBand?: AgeBand;
}): string {
  const band = opts.ageBand ?? "9-12";
  return [
    "You are an expert children's Arabic and Quran teacher and an experienced scriptwriter for short whiteboard animation videos.",
    "You work with a human tutor who gives you the lesson and refines the script with you in a chat. Be a collaborator: propose, ask short clarifying questions when something important is missing, and revise when asked.",
    "",
    "About the videos:",
    "- A friendly mascot (a small owl) explains one concept at a time while text, letters, shapes and pictures are drawn on a whiteboard.",
    "- The mascot talks (the narration is voiced by text to speech) and can wave, point, think, write or celebrate.",
    `- Things that can appear on the board:\n${ACTION_VOCABULARY}`,
    "",
    "Pacing rules:",
    "- 6 to 15 scenes, each 5 to 20 seconds, exactly one idea per scene.",
    "- Short spoken sentences. Repeat key words. Invite the child to repeat after the mascot.",
    "- Start with a warm greeting (and a salaam when appropriate) and end with praise and a one line recap.",
    "- Show Arabic words with full diacritics (tashkeel) for beginners.",
    "",
    `Audience age band: ${band} years old. Match vocabulary and tone to it.`,
    `Write the script in ${LANGUAGE_NAME[opts.locale]}. Use the tutor's language in the chat when it differs, but the script itself follows the language above.`,
    "",
    "Script format (use it whenever you present a full script):",
    "Scene 1 (about 8s)",
    "Narration: exactly what the mascot says.",
    "Board: what appears, in plain words (e.g. write the title, draw an arrow to the dot, show the letter with its forms).",
    "Mascot: pose such as wave, point, think, write, celebrate or talk.",
    "",
    "Adab and accuracy:",
    "- Be respectful of Islamic adab. Say the name of the Prophet with salawat when mentioned.",
    "- Quranic verses will be injected from the database by the system. Refer to an ayah by surah and ayah number (for example [1:2]) and never type, paraphrase or translate-and-present as Quran text yourself.",
    "- If you are unsure about a religious ruling, say so and suggest the tutor verify it.",
    "",
    HOUSE_STYLE,
    "",
    "LESSON CONTEXT",
    describeLesson(opts.lesson, opts.extraContext),
  ].join("\n");
}

export function buildScenePrompt(opts: {
  locale: "ar" | "en" | "tr";
  lesson: LessonPromptContext | null;
  extraContext?: string | null;
}): string {
  return [
    "You convert an approved lesson script for a whiteboard animation into a strict JSON scene document.",
    "The JSON must follow the provided schema exactly. Output JSON only.",
    "",
    "Rules:",
    `- locale is "${opts.locale}". title is the video title. board is "whiteboard" unless the script asks otherwise. mascot is "default".`,
    "- One scene per script scene. Scene ids: s1, s2, s3 and so on. narration is exactly the spoken text from the script (no stage directions).",
    `- mascot.pose is one of: ${MASCOT_POSES.join(", ")}. mascot.position is left or right (alternate sides when it helps layout) or hidden.`,
    "- Coordinates are percentages of the board (0 to 100). x is from the left edge, y from the top.",
    "  write, letter and ayah use x,y as the CENTER of the element. draw and image use x,y as the top left corner with w,h as size.",
    "- The mascot stands in the bottom corner on its side (about 22% of the width, the lower 35% of the height). Keep board content away from that corner: use x between 12 and 88 and y between 8 and 68 for most things.",
    "- Do not overlap elements. A scene normally has 1 to 6 actions. Keep text short (a few words per write action).",
    `- sizes: ${TEXT_SIZES.join(", ")}. colors: ${BOARD_COLORS.join(", ")}. Use ink for most text and one accent color per idea.`,
    "- at is the second (from the scene start) when an action begins; spread actions through the narration so the board follows what is said. durationSec is how long it takes to draw.",
    "- Use font \"naskh\" and dir \"rtl\" for Arabic text, \"hand\" and dir \"ltr\" for English or Turkish.",
    "- To point at something, give it an id and add a highlight action later with targetId. Use erase to clear a crowded board, or clearBoardBefore true to start a scene on a clean board.",
    "- For an ayah action set surah and ayah, and set text to the single character \"x\". The real text is inserted by the system.",
    "- For a letter action use one Arabic letter in the letter field.",
    `- image src must be one of: apple, book, star, house, cat, sun, moon, mosque, pen, heart.`,
    "- Never use the em dash character (U+2014) anywhere.",
    "",
    "LESSON CONTEXT",
    describeLesson(opts.lesson, opts.extraContext),
  ].join("\n");
}

// ───────────── Gemini schema ─────────────

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const DROP_KEYS = new Set(["$schema", "default", "minLength", "maxLength", "pattern", "propertyNames", "examples"]);

/**
 * `responseJsonSchema` accepts only a subset of JSON Schema. Convert what zod emits:
 * `const` becomes a one value `enum`, unsupported keywords are dropped.
 */
export function toGeminiSchema(schema: unknown): unknown {
  const walk = (node: Json): Json => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      const out: { [k: string]: Json } = {};
      for (const [k, v] of Object.entries(node)) {
        if (DROP_KEYS.has(k)) continue;
        if (k === "const") {
          out.enum = [v as Json];
          continue;
        }
        // keep property names that happen to equal a dropped keyword (e.g. a property called "default")
        out[k] = k === "properties" && v && typeof v === "object" && !Array.isArray(v) ? walkProps(v as { [k: string]: Json }) : walk(v);
      }
      return out;
    }
    return node;
  };
  const walkProps = (props: { [k: string]: Json }): Json => {
    const out: { [k: string]: Json } = {};
    for (const [name, def] of Object.entries(props)) out[name] = walk(def);
    return out;
  };
  return walk(schema as Json);
}

// ───────────── Scene post-processing ─────────────

export function formatIssues(err: z.ZodError): string {
  return err.issues
    .slice(0, 25)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

/** Applies `clean` (em dash stripping) to every piece of text a viewer or the voice will see. */
export function cleanSceneDocument(doc: SceneDocument, clean: (s: string) => string): SceneDocument {
  return {
    ...doc,
    title: clean(doc.title),
    scenes: doc.scenes.map((scene) => ({
      ...scene,
      narration: clean(scene.narration),
      actions: scene.actions.map((a) => (a.type === "write" ? { ...a, text: clean(a.text) } : a)),
    })),
  };
}

export type AyahLookup = Map<string, string>;
export const ayahKey = (surah: number, ayah: number) => `${surah}:${ayah}`;

export function collectAyahRefs(doc: SceneDocument): { surah: number; ayah: number }[] {
  const seen = new Map<string, { surah: number; ayah: number }>();
  for (const s of doc.scenes)
    for (const a of s.actions) if (a.type === "ayah") seen.set(ayahKey(a.surah, a.ayah), { surah: a.surah, ayah: a.ayah });
  return [...seen.values()];
}

/**
 * Quranic text never comes from the model: replace every ayah action's text with the
 * database text, or drop the action (and warn) when the ayah is unknown.
 */
export function applyVerbatimAyahs(doc: SceneDocument, lookup: AyahLookup): { doc: SceneDocument; warnings: string[] } {
  const warnings: string[] = [];
  const scenes = doc.scenes.map((scene) => ({
    ...scene,
    actions: scene.actions.flatMap((a): BoardAction[] => {
      if (a.type !== "ayah") return [a];
      const text = lookup.get(ayahKey(a.surah, a.ayah));
      if (!text) {
        warnings.push(`Scene ${scene.id}: ayah ${a.surah}:${a.ayah} was not found in the database and was removed.`);
        return [];
      }
      return [{ ...a, text }];
    }),
  }));
  return { doc: { ...doc, scenes }, warnings };
}

/** Make scene ids unique and non empty (the model sometimes repeats them). */
export function ensureUniqueSceneIds(doc: SceneDocument): SceneDocument {
  const seen = new Set<string>();
  return {
    ...doc,
    scenes: doc.scenes.map((s, i) => {
      let id = s.id || `s${i + 1}`;
      while (seen.has(id)) id = `${id}_${i + 1}`;
      seen.add(id);
      return { ...s, id: id.slice(0, 40) };
    }),
  };
}

/** Prefix used by client UIs to show where a script line starts. Kept here so UI and prompt agree. */
export const SCENE_MARKER = /^Scene\s+\d+/i;
