import { describe, expect, it } from "vitest";
import { displayWords, wordStatuses } from "./aligned-words";
import { alignWords } from "./word-diff";

const text = "قُلْ هُوَ ٱللَّهُ ۚ أَحَدٌ";

describe("displayWords", () => {
  it("numbers real words and skips lone annotation marks", () => {
    const words = displayWords(text);
    expect(words).toHaveLength(5);
    expect(words.map((w) => w.index)).toEqual([0, 1, 2, null, 3]);
  });
});

describe("wordStatuses", () => {
  it("marks matched, substituted and missing words", () => {
    const ops = alignWords("قل هو الله احد", "قل الملك احد");
    const statuses = wordStatuses(ops, 4);
    expect(statuses[0]).toBe("match");
    expect(statuses[3]).toBe("match");
    expect(statuses.filter((s) => s !== "match")).toHaveLength(2);
  });
});
