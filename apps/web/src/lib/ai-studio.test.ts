import { describe, expect, it } from "vitest";
import { sceneDocumentJsonSchema, sceneDocumentSchema } from "@mufasa/video/schema";
import {
  applyVerbatimAyahs,
  ayahKey,
  buildScenePrompt,
  buildSystemPrompt,
  cleanSceneDocument,
  ensureUniqueSceneIds,
  isStudioVoice,
  toGeminiSchema,
} from "./ai-studio";

const EM = String.fromCharCode(0x2014);
const clean = (s: string) => s.replaceAll(EM, ",");

const doc = sceneDocumentSchema.parse({
  title: `Ba ${EM} the letter`,
  locale: "ar",
  scenes: [
    {
      id: "s1",
      narration: `Hello ${EM} friends`,
      mascot: {},
      actions: [
        { type: "write", at: 0, text: `a ${EM} b`, x: 50, y: 50 },
        { type: "ayah", at: 1, surah: 1, ayah: 2, text: "x", x: 50, y: 50 },
        { type: "ayah", at: 2, surah: 114, ayah: 286, text: "x", x: 50, y: 60 },
      ],
    },
    { id: "s1", narration: "again", mascot: {}, actions: [] },
  ],
});

describe("prompts", () => {
  it("contain no em dash and include lesson context", () => {
    const p = buildSystemPrompt({
      lesson: { title: "Letter Ba", objectives: ["Recognize Ba"], ayahs: [{ surah: 1, ayah: 1, text: "TEXT" }] },
      extraContext: "use apples",
      locale: "ar",
    });
    expect(p).toContain("Letter Ba");
    expect(p).toContain("[1:1] TEXT");
    expect(p).toContain("use apples");
    expect(p).not.toContain(EM);
    expect(buildScenePrompt({ locale: "tr", lesson: null })).not.toContain(EM);
  });
});

describe("voices", () => {
  it("recognizes known voices", () => {
    expect(isStudioVoice("Kore")).toBe(true);
    expect(isStudioVoice("nope")).toBe(false);
  });
});

describe("toGeminiSchema", () => {
  it("converts const to enum and drops unsupported keywords", () => {
    const out = JSON.stringify(toGeminiSchema(sceneDocumentJsonSchema()));
    expect(out).not.toContain('"const"');
    expect(out).not.toContain('"$schema"');
    expect(out).not.toContain('"default"');
    expect(out).toContain('"enum"');
  });
});

describe("scene post-processing", () => {
  it("strips em dashes", () => {
    const c = cleanSceneDocument(doc, clean);
    expect(JSON.stringify(c)).not.toContain(EM);
  });
  it("replaces ayah text from the database and drops unknown ayat", () => {
    const { doc: out, warnings } = applyVerbatimAyahs(doc, new Map([[ayahKey(1, 2), "VERBATIM"]]));
    const ayat = out.scenes[0]!.actions.filter((a) => a.type === "ayah");
    expect(ayat).toHaveLength(1);
    expect(ayat[0]).toMatchObject({ text: "VERBATIM" });
    expect(warnings).toHaveLength(1);
  });
  it("dedupes scene ids", () => {
    const out = ensureUniqueSceneIds(doc);
    expect(new Set(out.scenes.map((s) => s.id)).size).toBe(2);
  });
});
