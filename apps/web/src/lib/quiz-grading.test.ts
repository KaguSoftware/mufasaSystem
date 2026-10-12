import { describe, expect, it } from "vitest";
import { gradeQuiz, isCorrect, normalizeText, type GradableQuestion } from "./quiz-grading";

const q = (over: Partial<GradableQuestion> & Pick<GradableQuestion, "id" | "type" | "answer">): GradableQuestion => ({
  points: 1,
  ...over,
});

describe("normalizeText", () => {
  it("strips Arabic diacritics and unifies alef and ya", () => {
    expect(normalizeText("كِتَابٌ")).toBe("كتاب");
    expect(normalizeText("أَحْمَد")).toBe(normalizeText("احمد"));
    expect(normalizeText("موسى")).toBe(normalizeText("موسي"));
  });
  it("lowercases, trims and drops punctuation", () => {
    expect(normalizeText("  Hello,   World! ")).toBe("hello world");
  });
});

describe("isCorrect", () => {
  it("single and true_false need the exact option", () => {
    expect(isCorrect(q({ id: "1", type: "single", answer: ["a"] }), ["a"])).toBe(true);
    expect(isCorrect(q({ id: "1", type: "single", answer: ["a"] }), ["b"])).toBe(false);
    expect(isCorrect(q({ id: "1", type: "single", answer: ["a"] }), ["a", "b"])).toBe(false);
    expect(isCorrect(q({ id: "2", type: "true_false", answer: ["true"] }), ["true"])).toBe(true);
    expect(isCorrect(q({ id: "3", type: "audio_choice", answer: ["o2"] }), ["o2"])).toBe(true);
  });
  it("multiple ignores order but needs the full set", () => {
    const m = q({ id: "1", type: "multiple", answer: ["a", "c"] });
    expect(isCorrect(m, ["c", "a"])).toBe(true);
    expect(isCorrect(m, ["a"])).toBe(false);
    expect(isCorrect(m, ["a", "b", "c"])).toBe(false);
    expect(isCorrect(m, ["a", "a"])).toBe(false);
  });
  it("text accepts any normalized variant", () => {
    const t = q({ id: "1", type: "text", answer: ["كتاب", "book"] });
    expect(isCorrect(t, ["كِتَاب"])).toBe(true);
    expect(isCorrect(t, [" BOOK "])).toBe(true);
    expect(isCorrect(t, ["pen"])).toBe(false);
    expect(isCorrect(t, [""])).toBe(false);
  });
  it("order is positional", () => {
    const o = q({ id: "1", type: "order", answer: ["a", "b", "c"] });
    expect(isCorrect(o, ["a", "b", "c"])).toBe(true);
    expect(isCorrect(o, ["a", "c", "b"])).toBe(false);
  });
  it("match compares pairs as a set", () => {
    const m = q({ id: "1", type: "match", answer: ["l1:r1", "l2:r2"] });
    expect(isCorrect(m, ["l2:r2", "l1:r1"])).toBe(true);
    expect(isCorrect(m, ["l1:r2", "l2:r1"])).toBe(false);
  });
  it("unanswered is wrong", () => {
    expect(isCorrect(q({ id: "1", type: "single", answer: ["a"] }), undefined)).toBe(false);
    expect(isCorrect(q({ id: "1", type: "single", answer: ["a"] }), [])).toBe(false);
  });
});

describe("gradeQuiz", () => {
  const questions = [
    q({ id: "a", type: "single", answer: ["x"], skill: "reading", points: 1 }),
    q({ id: "b", type: "single", answer: ["y"], skill: "reading", points: 1 }),
    q({ id: "c", type: "single", answer: ["z"], skill: "vocab", points: 2 }),
  ];
  it("weights by points and aggregates per skill", () => {
    const r = gradeQuiz(questions, { a: ["x"], b: ["nope"], c: ["z"] }, 0.7);
    expect(r.earned).toBe(3);
    expect(r.total).toBe(4);
    expect(r.score).toBeCloseTo(0.75);
    expect(r.skillScores).toEqual({ reading: 0.5, vocab: 1 });
    expect(r.passed).toBe(true);
    expect(r.perQuestion).toEqual({ a: true, b: false, c: true });
  });
  it("fails below the pass score and handles empty quizzes", () => {
    expect(gradeQuiz(questions, {}, 0.7).passed).toBe(false);
    const empty = gradeQuiz([], {}, 0);
    expect(empty.score).toBe(0);
    expect(empty.passed).toBe(false);
  });
});
