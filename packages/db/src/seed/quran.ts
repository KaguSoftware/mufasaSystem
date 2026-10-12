import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "../client";
import { quranAyahs } from "../schema";
import { stripArabicMarks } from "./arabic";

/**
 * Quran text seed (Tanzil Uthmani, pipe separated `surah|ayah|text`).
 *
 * Source: Tanzil Project, https://tanzil.net . The text is licensed under a
 * Creative Commons Attribution 3.0 license with these terms (see docs/quran-text.md):
 *   - the text must stay VERBATIM (no modification of the Uthmani text),
 *   - the source (Tanzil Project) must be clearly indicated and a link to tanzil.net given,
 *   - the copyright notice that ships at the end of the downloaded file must be kept
 *     in verbatim copies and derived files.
 * `textUthmani` is stored untouched. `textSimple` is a derived search/diff column.
 *
 * Where the text comes from, in order:
 *   1. packages/db/data/quran-uthmani.txt if present (offline seeding), or QURAN_TEXT_FILE;
 *   2. the Tanzil download endpoint below.
 */
export const TANZIL_URL = "https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&agree=true";
export const TOTAL_AYAHS = 6236;
const BATCH = 500;

/** First ayah of each juz (1..30) as [surah, ayah]. */
export const JUZ_STARTS: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41],
  [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1], [25, 21], [27, 56],
  [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1],
];

export function juzOf(surah: number, ayah: number): number {
  let juz = 1;
  for (let i = 0; i < JUZ_STARTS.length; i++) {
    const [s, a] = JUZ_STARTS[i]!;
    if (surah > s || (surah === s && ayah >= a)) juz = i + 1;
  }
  return juz;
}

export type ParsedAyah = { surah: number; ayah: number; text: string };

/** Parses Tanzil `surah|ayah|text` lines. Comment (#) and blank lines are skipped. */
export function parseTanzil(raw: string): ParsedAyah[] {
  const out: ParsedAyah[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const m = /^(\d{1,3})\|(\d{1,3})\|(.+)$/.exec(line);
    if (!m) continue;
    out.push({ surah: Number(m[1]), ayah: Number(m[2]), text: m[3]!.trim() });
  }
  return out;
}

async function loadRaw(): Promise<string> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const local = process.env.QURAN_TEXT_FILE || path.resolve(here, "../../data/quran-uthmani.txt");
  if (existsSync(local)) {
    console.log(`  quran: reading ${local}`);
    return readFileSync(local, "utf8");
  }
  console.log(`  quran: downloading ${TANZIL_URL}`);
  const res = await fetch(TANZIL_URL);
  if (!res.ok) throw new Error(`Tanzil download failed: HTTP ${res.status}. Save the file to packages/db/data/quran-uthmani.txt instead.`);
  return res.text();
}

export async function seedQuran(db: Db): Promise<void> {
  const parsed = parseTanzil(await loadRaw());
  if (parsed.length !== TOTAL_AYAHS) {
    throw new Error(`Quran seed: expected ${TOTAL_AYAHS} ayahs, parsed ${parsed.length}`);
  }
  const rows = parsed.map((p) => ({
    surah: p.surah,
    ayah: p.ayah,
    textUthmani: p.text,
    textSimple: stripArabicMarks(p.text),
    juz: juzOf(p.surah, p.ayah),
    page: null,
  }));
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.insert(quranAyahs).values(rows.slice(i, i + BATCH)).onConflictDoNothing();
  }
  console.log(`  quran: ${rows.length} ayahs`);
}
