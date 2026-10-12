import { describe, expect, it } from "vitest";
import { arabicWords, normalizeArabicWord, stripArabicMarks } from "./arabic-normalize";

describe("arabic normalization", () => {
  it("strips harakat and quranic marks", () => {
    expect(stripArabicMarks("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ")).toBe("بسم الله الرحمن الرحيم");
  });
  it("removes tatweel", () => {
    expect(stripArabicMarks("الـــله")).toBe("الله");
  });
  it("unifies letter variants for comparison", () => {
    expect(normalizeArabicWord("أَنْعَمْتَ")).toBe("انعمت");
    expect(normalizeArabicWord("الصلاة")).toBe(normalizeArabicWord("الصلاه"));
    expect(normalizeArabicWord("موسى")).toBe("موسي");
  });
  it("is idempotent", () => {
    const once = normalizeArabicWord("ٱلْمُؤْمِنُونَ");
    expect(normalizeArabicWord(once)).toBe(once);
  });
  it("splits into words", () => {
    expect(arabicWords("  قُلْ  هُوَ ٱللَّهُ أَحَدٌ ")).toEqual(["قل", "هو", "الله", "احد"]);
  });
});
