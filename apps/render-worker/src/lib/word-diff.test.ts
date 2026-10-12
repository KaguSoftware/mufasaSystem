import { describe, expect, it } from "vitest";
import { alignWordLists, alignWords, charDistance, diffIssues, wordAccuracy } from "./word-diff";

const ikhlas = "قُلْ هُوَ ٱللَّهُ أَحَدٌ";

describe("charDistance", () => {
  it("computes edit distance", () => {
    expect(charDistance("abc", "abc")).toBe(0);
    expect(charDistance("abc", "abd")).toBe(1);
    expect(charDistance("", "abc")).toBe(3);
  });
});

describe("alignWords", () => {
  it("matches identical text regardless of diacritics", () => {
    const ops = alignWords(ikhlas, "قل هو الله احد");
    expect(ops.every((o) => o.kind === "match")).toBe(true);
    expect(wordAccuracy(ops)).toBe(1);
    expect(diffIssues(ops)).toEqual([]);
  });

  it("detects a missing word", () => {
    const ops = alignWords(ikhlas, "قل هو احد");
    const issues = diffIssues(ops);
    expect(issues).toEqual([{ index: 2, expected: "الله", kind: "missing" }]);
    expect(wordAccuracy(ops)).toBe(0.75);
  });

  it("detects an extra word", () => {
    const ops = alignWords(ikhlas, "قل هو الله الله احد");
    const issues = diffIssues(ops);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.kind).toBe("extra");
    expect(wordAccuracy(ops)).toBeCloseTo(0.8, 5);
  });

  it("detects a substitution and prefers aligning similar words", () => {
    const ops = alignWords(ikhlas, "قل هو اللة احد");
    expect(ops.filter((o) => o.kind !== "match")).toHaveLength(0);
    const sub = alignWordLists(["قل", "هو", "الله", "احد"], ["قل", "هو", "الملك", "احد"]);
    expect(sub[2]).toMatchObject({ kind: "substitute", expected: "الله", heard: "الملك" });
    expect(diffIssues(sub)[0]).toMatchObject({ index: 2, kind: "mispronounced" });
  });

  it("handles empty transcript and empty expected", () => {
    const none = alignWords(ikhlas, "");
    expect(none.every((o) => o.kind === "missing")).toBe(true);
    expect(wordAccuracy(none)).toBe(0);
    expect(wordAccuracy(alignWords("", ""))).toBe(0);
  });
});
