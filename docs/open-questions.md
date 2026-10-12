# Open questions for the client

Decisions the code deliberately leaves open. Ask the client; most answers are a settings/data change, not code.

## Brand

- [ ] Academy name, logo, colors, typography. (Change `packages/config/src/brand.ts` + tokens in `apps/web/src/app/globals.css`.)
- [ ] Mascot design and name (currently a placeholder owl). Need one image per pose: idle, talk, point, think, celebrate, wave, write. See `docs/ai-video-pipeline.md`.
- [ ] Domain name and sending email domain (Resend).

## Curriculum

- [ ] Which subjects exactly? Quran (recitation, hifz, tajweed), Arabic language, Arabic literature, Islamic studies? Subjects are admin-managed **programs** (seeded examples: "Quran", "Arabic Language"), so this is data entry.
- [ ] Age bands and levels per course.
- [ ] Placement test questions and the rules mapping scores to courses.
- [ ] Hifz conventions: memorize forwards or backwards (from Juz Amma)? Weekly targets?

## Payments

- [ ] Prices, currencies (TRY only, or USD/EUR for abroad), plan structure (monthly / quarterly / family).
- [ ] IBAN, bank name, account holder, WhatsApp business number (*Admin > Settings*).
- [ ] Is card payment (iyzico) wanted at launch? Needs a merchant account and identity verification.
- [ ] Refund and cancellation policy.
- [ ] Invoicing (Turkish e-Arsiv / e-Fatura)?

## Live classes

- [ ] Built-in LiveKit rooms or keep Google Meet/Zoom links? (Both work; LiveKit needs a LiveKit Cloud account.)
- [ ] Group size limits, session length, 1:1 lesson pricing.
- [ ] Recording: currently never recorded. Should it be possible with parental consent?

## Child safety and legal

- [ ] Privacy policy, terms, KVKK notice, cookie policy: template text exists under `/legal/*` and **must be reviewed by a lawyer**.
- [ ] Policy on self-registered students aged 13 to 17 (they currently consent for themselves; parental consent is required only for parent-created child accounts).
- [ ] Data retention periods (recitation audio, messages, exports).

## AI

- [ ] Gemini API account and billing; data processing terms for children's audio (recitation feedback can be disabled per child by parents and globally by a feature flag).
- [ ] Voices for each language (TTS voice defaults in `apps/web/src/lib/studio-voices.ts`).
- [ ] Remotion license: free for companies with up to 3 employees, otherwise a company license.
