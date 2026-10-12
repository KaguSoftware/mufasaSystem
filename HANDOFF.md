# HANDOFF

**Read first:** `CLAUDE.md` (rules + conventions), then this file, then `docs/` as needed.

| Doc | What |
| --- | --- |
| `docs/supabase-setup.md` | **Start here.** Connecting Supabase and every integration, demo accounts, deploy |
| `docs/architecture.md` | How the pieces fit, request flow, security boundary, child safety |
| `docs/data-model.md` | Tables by domain, seed |
| `docs/api.md` | Route handlers, server actions, worker jobs |
| `docs/billing.md` | Manual IBAN/WhatsApp flow, admin grants, iyzico, access rule |
| `docs/ai-video-pipeline.md` | AI studio, scene JSON, TTS, Remotion worker, mascot |
| `docs/ui-kit.md` | Tokens and components for the frontend redesign |
| `docs/quran-text.md` | Tanzil Quran text: source, license, attribution |
| `docs/open-questions.md` | Decisions waiting on the client |
| `docs/agents/module-brief.md` | Conventions brief used for module work (useful for future Claude sessions) |

## People

- **Parsa**: backend and setup (this phase).
- **Majed**: frontend polish, connecting Supabase, finishing the system. Ask him about missing details; record answers in `docs/open-questions.md`.

## State (2026-10-12)

The backend and a deliberately plain but complete UI are built. **Nothing has been run against a real database or external service yet**: there was no Supabase account. Everything typechecks, lints, passes tests (203 unit tests), and `pnpm build` succeeds with no `.env` (201 pages). Panels show a "database not connected" notice until `DATABASE_URL` is set.

Verified for real during development:

- Production build and every page route (200s without a DB, localized 404s).
- The Remotion whiteboard renderer: `pnpm --filter render-worker render:sample` renders a 34 s 1080p MP4 with correct Arabic shaping and the placeholder owl mascot.
- Certificate PDFs (en, ar, tr) render; Arabic checked visually (Amiri font, correct shaping and date order).
- Public site screenshots in English and Arabic (RTL mirrored correctly).

### Built

| Area | Highlights |
| --- | --- |
| Foundation | pnpm monorepo, Next.js 16 (`proxy.ts`), Drizzle schema (64 tables) + migration, Better Auth (email/password, Google, username + PIN for kids, email OTP, 2FA, admin plugin), next-intl en/ar/tr with RTL, DAL + `action()` wrapper, feature flags, rate limits, audit log, storage adapter, job queue |
| UI kit | Custom Select/Combobox/Multi-select, DatePicker + time, Dialog/Sheet, Dropdown, Tabs, Checkbox/Switch/Radio, ScrollArea + global custom scrollbars, Dropzone, Table, Toasts, light/dark theme. Showcase at `/en/ui` |
| Public site | Landing, programs, course pages, pricing, tutors, FAQ, contact (WhatsApp), legal templates (privacy, terms, KVKK, cookies), sitemap, robots, hreflang |
| Accounts | Sign in/up, onboarding, parent creates child accounts (username + PIN) with consent, account settings, notifications, data export/deletion requests |
| Catalog + learning | Admin CMS for programs/courses/units/lessons/quizzes, lesson player with progress, quizzes (7 question types), placement test with rules |
| Gamification | XP (idempotent), timezone-aware streaks with weekly freeze, badge rules engine |
| Billing + access | Manual IBAN/WhatsApp payments with receipt upload and admin approval, admin "give access" page, plans and coupons, iyzico subscriptions (behind a flag), expiry reminders |
| Hifz + recitation | Quran text seed (6236 ayahs), memorization plans and coverage, in-browser recorder, AI recitation feedback (Gemini + deterministic word diff), tutor review queue |
| Homework | Lesson / quiz / recitation / free-text homework, reviews, due reminders |
| Live classes | Groups, sessions (LiveKit built-in rooms or Meet/Zoom links), attendance (manual + LiveKit webhook), tutor availability and 1:1 bookings, reminders |
| AI studio | Tutor chats with Gemini to write the script, approve, scene JSON generation (Quran text injected verbatim from DB), Gemini TTS, Remotion render, preview, publish to lesson |
| Certificates | Auto-issued on course completion, PDF via worker, public verification page |
| Messaging | Parent and tutor threads with child-safety guard |
| Admin | Users (roles, ban, impersonate, staff creation), access and payments, plans, programs, courses, groups, studio, announcements, flags, audit log, certificates, settings |
| Ops | Sentry (no-op without DSN), weekly parent digest email, Vercel crons |

### Not verified yet (needs keys/accounts)

- Every DB query at runtime (run `pnpm db:setup`, then the smoke test in `docs/supabase-setup.md`).
- iyzico: webhook event names and V3 signature field order (see `docs/billing.md`). Keep flag `iyzico_checkout` off until tested in sandbox.
- Gemini: structured output with our simplified schema, TTS output, and whether inline `audio/webm` is accepted for recitations (may need a transcode step in the worker).
- LiveKit: room UX in a browser, webhooks, mute-all.
- Resend emails (they are logged to the console without a key).

### Known gaps / next steps

1. Connect Supabase (`docs/supabase-setup.md`) and run the smoke test.
2. Frontend redesign (Majed): restyle tokens + `src/components/ui`, then pages. Keep RTL, i18n and no-em-dash rules.
3. Brand: name, logo, mascot art per pose (`docs/open-questions.md`).
4. Legal review of `/legal/*` templates (lawyer).
5. Small items: 2FA QR code (no QR lib yet, shows the secret/URI), avatar upload, per-user digest opt-out, notifications storing English plan names, students have no Messages page (adult students supported in the DAL), placement rules have no editing UI (seeded), lesson video upload UI (video path is a text field; upload via Supabase dashboard for now), certificate QR code.
6. Deploy: web on Vercel (root `apps/web`), worker on a container host (`pnpm worker`).

## Security review (2026-10-12)

A cross-module review of every DAL file, server action and route handler found no critical or high issues. All medium findings and most low ones were fixed: students get meeting links only through the consent and time-window checks; course completion requires real progress (server-side video duration) and certificates require passed quizzes; minors are shown by first name only everywhere; unknown-age students need a birth year before live video, recordings or AI feedback; parents can't widen tutor-certified memorization; unpublished courses are hidden; data exports are downloadable and deletions remove stored files.

Open decisions (not bugs, confirm with the client):

- Tutors can currently edit any lesson, mark lessons as free previews and publish studio videos to any lesson (not only their own courses).
- Better Auth's built-in admin endpoints let an admin change roles directly, bypassing our child-account guard and audit log (admin-only).
- Child PIN sign-in is rate limited per IP but has no per-account lockout yet (TODO in `server/auth.ts`).
- Deleting an account removes recitations, receipts, certificates, homework files and exports from storage, but not avatars or message attachments.

## Commands

```bash
pnpm install
pnpm dev                 # http://localhost:3000
pnpm check               # no-em-dash check + typecheck + lint + tests (run before every commit)
pnpm build
pnpm db:setup            # migrate + RLS + seed + storage buckets (needs .env)
pnpm db:generate         # after schema changes
pnpm worker              # background jobs (needs DB)
pnpm --filter render-worker render:sample        # offline video render test
pnpm --filter render-worker certificate:sample   # offline certificate PDF test
```

## Rules recap

No Claude co-author tags in commits. Zero em dashes anywhere. All DB access through the DAL. All UI text through `messages/*.ts` (en first). Logical (RTL-safe) CSS only. Integrations must degrade without keys.
