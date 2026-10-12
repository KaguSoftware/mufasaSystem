/**
 * Pure Arabic text helpers. Copy of packages/db/src/seed/arabic.ts (web cannot
 * import seed code); keep both files in sync.
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
