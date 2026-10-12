import type { QuestionOption, QuestionType } from "@mufasa/db/schema";

export type GradableQuestion = {
  id: string;
  type: QuestionType;
  options?: QuestionOption[];
  /**
   * Option ids (single, multiple, true_false, audio_choice), accepted texts (text),
   * ordered option ids (order), or "leftId:rightId" pairs (match).
   */
  answer: string[];
  points: number;
  skill?: string | null;
};

export type AnswerMap = Record<string, string[]>;

export type GradeResult = {
  /** 0..1, weighted by points. */
  score: number;
  earned: number;
  total: number;
  perQuestion: Record<string, boolean>;
  /** 0..1 per skill tag (questions without a skill are ignored here). */
  skillScores: Record<string, number>;
  passed: boolean;
};

const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const PUNCTUATION = /[.,;:!?'"()[\]{}،؛؟-]/g;

/** Normalizes free text for comparison: case, diacritics (incl. Arabic tashkeel), alef/ya variants, punctuation. */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(ARABIC_MARKS, "")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .toLocaleLowerCase()
    .replace(PUNCTUATION, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const sameSet = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return new Set(a).size === a.length && a.every((x) => sb.has(x));
};

export function isCorrect(q: GradableQuestion, given: string[] | undefined): boolean {
  if (!given || given.length === 0) return false;
  switch (q.type) {
    case "single":
    case "true_false":
    case "audio_choice":
      return given.length === 1 && q.answer.length > 0 && given[0] === q.answer[0];
    case "multiple":
    case "match":
      return sameSet(given, q.answer);
    case "order":
      return given.length === q.answer.length && given.every((x, i) => x === q.answer[i]);
    case "text": {
      const g = normalizeText(given[0] ?? "");
      return g.length > 0 && q.answer.some((a) => normalizeText(a) === g);
    }
    default:
      return false;
  }
}

export function gradeQuiz(questions: GradableQuestion[], answers: AnswerMap, passScore: number): GradeResult {
  let earned = 0;
  let total = 0;
  const perQuestion: Record<string, boolean> = {};
  const skillEarned: Record<string, number> = {};
  const skillTotal: Record<string, number> = {};
  for (const q of questions) {
    const pts = Math.max(0, q.points);
    const ok = isCorrect(q, answers[q.id]);
    perQuestion[q.id] = ok;
    total += pts;
    if (ok) earned += pts;
    if (q.skill) {
      skillTotal[q.skill] = (skillTotal[q.skill] ?? 0) + pts;
      if (ok) skillEarned[q.skill] = (skillEarned[q.skill] ?? 0) + pts;
    }
  }
  const score = total > 0 ? earned / total : 0;
  const skillScores: Record<string, number> = {};
  for (const [k, t] of Object.entries(skillTotal)) skillScores[k] = t > 0 ? (skillEarned[k] ?? 0) / t : 0;
  return { score, earned, total, perQuestion, skillScores, passed: total > 0 && score >= passScore };
}
