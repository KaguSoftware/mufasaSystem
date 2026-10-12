import { normalizeArabicWord } from "./arabic-normalize";
import type { WordOp } from "./word-diff";

export type DisplayWord = {
  /** Verbatim Uthmani token. */
  text: string;
  /** Index into the normalized expected words, or null for pure annotation marks. */
  index: number | null;
};

/**
 * Splits Uthmani text into display tokens and numbers the ones that count as words,
 * so token indexes line up with `arabicWords(textSimple)` used by the word diff.
 */
export function displayWords(uthmani: string): DisplayWord[] {
  let next = 0;
  return uthmani
    .split(/\s+/)
    .filter(Boolean)
    .map((text) => (normalizeArabicWord(text) ? { text, index: next++ } : { text, index: null }));
}

export type WordStatus = "match" | "substitute" | "missing";

/** Status of every expected word according to the alignment. */
export function wordStatuses(ops: WordOp[], expectedCount: number): WordStatus[] {
  const out: WordStatus[] = new Array<WordStatus>(expectedCount).fill("missing");
  for (const o of ops) {
    if (o.expectedIndex === undefined || o.expectedIndex >= expectedCount) continue;
    out[o.expectedIndex] = o.kind === "match" ? "match" : o.kind === "substitute" ? "substitute" : "missing";
  }
  return out;
}
