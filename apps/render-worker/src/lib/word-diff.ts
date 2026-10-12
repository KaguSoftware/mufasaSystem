/**
 * Deterministic word-level alignment (Levenshtein over normalized Arabic words)
 * between the expected ayah text and an ASR transcript. Copy of apps/web/src/lib/word-diff.ts
 * (the worker cannot import web code); the Arabic helpers from arabic-normalize.ts are inlined. Keep in sync.
 */

/** Harakat, shadda, sukun, dagger alef and the Quranic annotation marks. */
const MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿ]/g;
const TATWEEL = /ـ/g;

/**
 * "Simple" text: removes diacritics, tatweel and Quranic annotation marks.
 * Letters (including hamza seats) are kept as written; alef wasla becomes a
 * plain alef so the result reads like ordinary Arabic.
 */
export function stripArabicMarks(input: string): string {
  return input
    .normalize("NFC")
    .replace(MARKS, "")
    .replace(TATWEEL, "")
    .replace(/ٱ/g, "ا")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Comparison form of a word: marks stripped, then letter variants unified
 * (alef forms to alef, alef maqsura to ya, ta marbuta to ha). Idempotent.
 */
export function normalizeArabicWord(input: string): string {
  return stripArabicMarks(input)
    .replace(/[آأإ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

/** Splits text into normalized, non-empty words. */
export function arabicWords(input: string): string[] {
  return normalizeArabicWord(input)
    .split(/\s+/)
    .filter(Boolean);
}

export type WordOpKind = "match" | "substitute" | "missing" | "extra";

export type WordOp = {
  kind: WordOpKind;
  /** Normalized expected word (absent for "extra"). */
  expected?: string;
  /** Normalized heard word (absent for "missing"). */
  heard?: string;
  /** Index into the expected words (absent for "extra"). */
  expectedIndex?: number;
  /** Index into the heard words (absent for "missing"). */
  heardIndex?: number;
};

/** Character edit distance between two words. */
export function charDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n]!;
}

/** Substituting two different words costs 0.4..1.0 (more similar = cheaper); insert/delete cost 1. */
function subCost(a: string, b: string): number {
  if (a === b) return 0;
  const ratio = charDistance(a, b) / Math.max(a.length, b.length);
  return 0.4 + 0.6 * ratio;
}

export function alignWordLists(expected: string[], heard: string[]): WordOp[] {
  const m = expected.length;
  const n = heard.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) d[i]![0] = i;
  for (let j = 1; j <= n; j++) d[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i]![j] = Math.min(
        d[i - 1]![j - 1]! + subCost(expected[i - 1]!, heard[j - 1]!),
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
      );
    }
  }
  const ops: WordOp[] = [];
  let i = m;
  let j = n;
  const EPS = 1e-9;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && Math.abs(d[i]![j]! - (d[i - 1]![j - 1]! + subCost(expected[i - 1]!, heard[j - 1]!))) < EPS) {
      const same = expected[i - 1] === heard[j - 1];
      ops.push({
        kind: same ? "match" : "substitute",
        expected: expected[i - 1],
        heard: heard[j - 1],
        expectedIndex: i - 1,
        heardIndex: j - 1,
      });
      i--;
      j--;
    } else if (i > 0 && Math.abs(d[i]![j]! - (d[i - 1]![j]! + 1)) < EPS) {
      ops.push({ kind: "missing", expected: expected[i - 1], expectedIndex: i - 1 });
      i--;
    } else {
      ops.push({ kind: "extra", heard: heard[j - 1], heardIndex: j - 1 });
      j--;
    }
  }
  return ops.reverse();
}

/** Aligns two raw Arabic strings (marks stripped, letter variants unified). */
export function alignWords(expectedText: string, heardText: string): WordOp[] {
  return alignWordLists(arabicWords(expectedText), arabicWords(heardText));
}

/**
 * Accuracy 0..1: matched words divided by (expected words + extra heard words),
 * so skipping words and adding words both lower the score.
 */
export function wordAccuracy(ops: WordOp[]): number {
  const matches = ops.filter((o) => o.kind === "match").length;
  const expected = ops.filter((o) => o.kind !== "extra").length;
  const extra = ops.filter((o) => o.kind === "extra").length;
  const denom = expected + extra;
  return denom === 0 ? 0 : Math.round((matches / denom) * 1000) / 1000;
}

export type WordIssue = { index: number; expected?: string; heard?: string; kind: "missing" | "extra" | "mispronounced" };

/** Non-matching ops as issues. `index` is the expected word index (for extras: the position they appear at). */
export function diffIssues(ops: WordOp[]): WordIssue[] {
  const issues: WordIssue[] = [];
  let consumed = 0;
  for (const o of ops) {
    if (o.kind === "extra") {
      issues.push({ index: consumed, heard: o.heard, kind: "extra" });
      continue;
    }
    if (o.kind === "missing") issues.push({ index: o.expectedIndex!, expected: o.expected, kind: "missing" });
    else if (o.kind === "substitute") {
      issues.push({ index: o.expectedIndex!, expected: o.expected, heard: o.heard, kind: "mispronounced" });
    }
    consumed = o.expectedIndex! + 1;
  }
  return issues;
}
