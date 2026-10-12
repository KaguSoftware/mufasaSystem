import { describe, expect, it } from "vitest";
import { evaluatePlacement, matchesCondition, type PlacementRuleLike } from "./placement";

const rules: PlacementRuleLike[] = [
  { condition: { maxScore: 0.4 }, courseId: "beginner", priority: 10 },
  { condition: { minScore: 0.4, maxScore: 0.75 }, courseId: "elementary", priority: 10 },
  { condition: { minScore: 0.75 }, courseId: "advanced", priority: 10 },
  { condition: { skills: { reading: { max: 0.5 } } }, courseId: "letters", priority: 20 },
  { condition: { ageMin: 4, ageMax: 8 }, courseId: "kids", priority: 5 },
];

describe("matchesCondition", () => {
  it("minScore inclusive, maxScore exclusive", () => {
    expect(matchesCondition({ minScore: 0.4 }, { score: 0.4, skillScores: {}, age: null })).toBe(true);
    expect(matchesCondition({ maxScore: 0.4 }, { score: 0.4, skillScores: {}, age: null })).toBe(false);
  });
  it("requires skill scores to exist", () => {
    expect(matchesCondition({ skills: { reading: { min: 0.5 } } }, { score: 1, skillScores: {}, age: null })).toBe(false);
    expect(matchesCondition({ skills: { reading: { min: 0.5 } } }, { score: 1, skillScores: { reading: 0.6 }, age: null })).toBe(true);
  });
  it("ignores age bounds when age is unknown", () => {
    expect(matchesCondition({ ageMin: 10 }, { score: 0, skillScores: {}, age: null })).toBe(true);
    expect(matchesCondition({ ageMin: 10 }, { score: 0, skillScores: {}, age: 9 })).toBe(false);
    expect(matchesCondition({ ageMax: 10 }, { score: 0, skillScores: {}, age: 11 })).toBe(false);
  });
});

describe("evaluatePlacement", () => {
  it("returns matches by priority, highest first, deduped", () => {
    expect(evaluatePlacement(rules, { score: 0.3, skillScores: { reading: 0.2 }, age: 7 })).toEqual([
      "letters",
      "beginner",
      "kids",
    ]);
  });
  it("picks the right band", () => {
    expect(evaluatePlacement(rules, { score: 0.5, skillScores: { reading: 0.9 }, age: 12 })).toEqual(["elementary"]);
    expect(evaluatePlacement(rules, { score: 0.9, skillScores: { reading: 0.9 }, age: 12 })).toEqual(["advanced"]);
  });
  it("returns nothing when no rule matches", () => {
    expect(evaluatePlacement([], { score: 0.5, skillScores: {}, age: 9 })).toEqual([]);
  });
});
