/**
 * Arabic letter positional forms, built with ZWJ (U+200D) so the browser's
 * shaping engine picks the right glyph. Pure, so it is unit tested.
 */
const ZWJ = "‍";

/** Letters that never join to the following letter (so initial = isolated and medial = final). */
const NON_CONNECTING = new Set([
  "ا", // alef
  "أ", // alef with hamza above
  "إ", // alef with hamza below
  "آ", // alef with madda
  "د", // dal
  "ذ", // thal
  "ر", // ra
  "ز", // zay
  "و", // waw
  "ؤ", // waw with hamza
  "ة", // teh marbuta
  "ء", // hamza
  "ى", // alef maksura
]);

export type LetterForms = { isolated: string; initial: string; medial: string; final: string };

export function connectsToNext(letter: string): boolean {
  return !NON_CONNECTING.has(letter.normalize("NFC").charAt(0));
}

export function letterForms(letter: string): LetterForms {
  const l = letter.normalize("NFC");
  if (!connectsToNext(l)) {
    return { isolated: l, initial: l, medial: ZWJ + l, final: ZWJ + l };
  }
  return { isolated: l, initial: l + ZWJ, medial: ZWJ + l + ZWJ, final: ZWJ + l };
}

export const FORM_LABELS = {
  ar: { isolated: "منفصلة", initial: "أول الكلمة", medial: "وسط الكلمة", final: "آخر الكلمة" },
  en: { isolated: "Alone", initial: "Start", medial: "Middle", final: "End" },
  tr: { isolated: "Tek", initial: "Başta", medial: "Ortada", final: "Sonda" },
} as const;
