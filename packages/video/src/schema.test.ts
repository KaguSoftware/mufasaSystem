import { describe, expect, it } from "vitest";
import sample from "./fixtures/sample-scene.json";
import { sceneDocumentJsonSchema, sceneDocumentSchema, sceneDuration, totalDurationInFrames, VIDEO } from "./schema";
import { connectsToNext, letterForms } from "./letter-forms";
import { carryOver, actionBox, sceneLayout } from "./remotion/timeline";
import { shapePath } from "./remotion/shapes";

describe("sample scene fixture", () => {
  const doc = sceneDocumentSchema.parse(sample);

  it("validates and has 4 scenes", () => {
    expect(doc.scenes).toHaveLength(4);
    expect(doc.locale).toBe("ar");
  });

  it("lays scenes back to back", () => {
    const layout = sceneLayout(doc);
    expect(layout[0]!.from).toBe(0);
    expect(layout[1]!.from).toBe(layout[0]!.frames);
    const sum = layout.reduce((s, l) => s + l.frames, 0);
    expect(sum).toBe(totalDurationInFrames(doc));
    expect(sceneDuration(doc.scenes[0]!)).toBeCloseTo(6 + VIDEO.tailSec);
  });

  it("produces a JSON schema for Gemini", () => {
    const js = sceneDocumentJsonSchema() as { type?: string };
    expect(js.type).toBe("object");
  });

  it("contains no em dash", () => {
    expect(JSON.stringify(sample)).not.toContain(String.fromCharCode(0x2014));
  });
});

describe("letterForms", () => {
  it("joins connecting letters with ZWJ", () => {
    const f = letterForms("ب");
    expect(f.initial).toBe("ب‍");
    expect(f.medial).toBe("‍ب‍");
    expect(f.final).toBe("‍ب");
  });
  it("does not join after alef", () => {
    expect(connectsToNext("ا")).toBe(false);
    expect(letterForms("ا").initial).toBe("ا");
  });
});

describe("timeline", () => {
  const doc = sceneDocumentSchema.parse({
    title: "t",
    locale: "en",
    scenes: [
      { id: "a", narration: "x", mascot: {}, actions: [{ type: "write", id: "w1", at: 0, text: "hi", x: 50, y: 50 }, { type: "write", id: "w2", at: 1, text: "yo", x: 50, y: 60 }] },
      { id: "b", narration: "x", mascot: {}, actions: [{ type: "erase", at: 0, targetId: "w1" }] },
      { id: "c", narration: "x", mascot: {}, actions: [] },
      { id: "d", narration: "x", mascot: {}, clearBoardBefore: true, actions: [] },
    ],
  });
  it("carries board content until erased or cleared", () => {
    expect(carryOver(doc, 0)).toHaveLength(0);
    expect(carryOver(doc, 1)).toHaveLength(2);
    expect(carryOver(doc, 2).map((a) => ("id" in a ? a.id : ""))).toEqual(["w2"]);
    expect(carryOver(doc, 3)).toHaveLength(0);
  });
  it("computes boxes", () => {
    const box = actionBox(doc.scenes[0]!.actions[0]!)!;
    expect(box.x).toBeLessThan(50);
    expect(box.w).toBeGreaterThan(0);
  });
});

describe("shapePath", () => {
  it("mirrors with flip", () => {
    expect(shapePath("line", 100, 50, false)).toBe("M0,0 L100,50");
    expect(shapePath("line", 100, 50, true)).toBe("M100,0 L0,50");
  });
});
