export type PlacementCondition = {
  minScore?: number;
  maxScore?: number;
  skills?: Record<string, { min?: number; max?: number }>;
  ageMin?: number;
  ageMax?: number;
};

export type PlacementRuleLike = { condition: PlacementCondition; courseId: string; priority: number };

export type PlacementInput = {
  score: number;
  skillScores: Record<string, number>;
  /** Null when unknown: age bounds are then ignored. */
  age: number | null;
};

export function matchesCondition(c: PlacementCondition, input: PlacementInput): boolean {
  if (c.minScore !== undefined && input.score < c.minScore) return false;
  if (c.maxScore !== undefined && input.score >= c.maxScore) return false;
  if (c.skills) {
    for (const [skill, range] of Object.entries(c.skills)) {
      const v = input.skillScores[skill];
      if (v === undefined) return false;
      if (range.min !== undefined && v < range.min) return false;
      if (range.max !== undefined && v >= range.max) return false;
    }
  }
  if (input.age !== null) {
    if (c.ageMin !== undefined && input.age < c.ageMin) return false;
    if (c.ageMax !== undefined && input.age > c.ageMax) return false;
  }
  return true;
}

/**
 * Evaluates rules highest priority first and returns the distinct course ids of
 * every matching rule, in that order. minScore is inclusive and maxScore exclusive,
 * so adjacent bands (0..0.4, 0.4..0.7) never overlap.
 */
export function evaluatePlacement(rules: PlacementRuleLike[], input: PlacementInput): string[] {
  const out: string[] = [];
  for (const r of [...rules].sort((a, b) => b.priority - a.priority)) {
    if (matchesCondition(r.condition, input) && !out.includes(r.courseId)) out.push(r.courseId);
  }
  return out;
}
