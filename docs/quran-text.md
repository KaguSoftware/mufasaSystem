# Quran text (Tanzil)

The `quran_ayahs` table (6236 rows) is seeded by `packages/db/src/seed/quran.ts` (`seedQuran`, registered right after `seedSurahs`) from the **Tanzil Project** Uthmani text.

## Getting the data

`pnpm db:seed` reads, in order:

1. `QURAN_TEXT_FILE` (env) or `packages/db/data/quran-uthmani.txt` when the file exists (offline seeding);
2. otherwise it downloads `https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&agree=true`.

To save the file manually: open tanzil.net/download, choose Text type "Uthmani", Output "Text (with aya numbers)" (pipe separated `surah|ayah|text`), tick "Include copyright notice", and save as `packages/db/data/quran-uthmani.txt`. The seed asserts exactly 6236 parsed ayahs and is idempotent (`onConflictDoNothing`, batches of 500).

Columns: `text_uthmani` is the verbatim Tanzil text. `text_simple` is derived by `stripArabicMarks` (diacritics, tatweel and Quranic annotation marks removed, alef wasla to alef); it feeds the deterministic recitation word diff. `juz` comes from the standard juz start table; `page` is null (not in this dataset).

## License and attribution (must be kept)

Tanzil Quran Text, copyright (C) Tanzil Project, license Creative Commons Attribution 3.0. Terms:

- The text may be used in any website or application, provided that its source (Tanzil Project) is clearly indicated and a link to https://tanzil.net is made so users can keep track of changes.
- The text must stay verbatim: **modifying it is not allowed**. Never edit `text_uthmani`.
- The copyright notice that ships with the downloaded file must be included in all verbatim copies and files derived from or containing a substantial portion of the text.

UI requirement: any page that shows Quran text should be able to show "Quran text: Tanzil Project (tanzil.net)". The hifz and recitation pages render this attribution via the `hifz.attribution` message; keep it when redesigning.
