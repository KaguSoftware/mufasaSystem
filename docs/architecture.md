# Architecture

## Big picture

```text
                ┌────────────────────────── apps/web (Next.js 16, Vercel) ──────────────────────────┐
 Browser ──────►│ proxy.ts (locale + optimistic auth redirect)                                      │
                │ app/[locale]/(site)        public website                                          │
                │ app/[locale]/(auth)        sign in / up / OTP / reset                              │
                │ app/[locale]/(panel)/<role> admin | tutor | parent | student panels (PanelGate)    │
                │ app/[locale]/live/[id]     LiveKit classroom                                       │
                │ app/api/*                  auth, webhooks (iyzico, LiveKit), cron, studio stream   │
                │   server/actions  ──►  server/dal  ──►  Drizzle  ──►  Supabase Postgres            │
                │   server/services (gemini, iyzico, livekit, email, gamification, certificates...)  │
                └───────────┬───────────────────────────────────────────────┬───────────────────────┘
                            │ jobs table (queue)                             │ Supabase Storage
                ┌───────────▼──────────── apps/render-worker (container) ────▼───────────────────────┐
                │ polls jobs (FOR UPDATE SKIP LOCKED): render_video, tts_project, recitation_ai,      │
                │ certificate_pdf, data_export → Gemini / Remotion / react-pdf → Storage + DB         │
                └─────────────────────────────────────────────────────────────────────────────────────┘
```

## Request flow (a mutation)

1. Client component calls a server action from `src/server/actions/<domain>.ts`.
2. `action()` (`src/server/action.ts`) validates input with zod, loads the session, checks role, feature flag and rate limit.
3. The action calls a DAL function `dal.<fn>(user, input)`. The DAL authorizes the specific object (ownership, parent-of, tutor-of, paid access) and then queries Drizzle.
4. Errors are `AppError` with a code; the action returns `{ ok: false, error: { code } }` and the UI maps the code to `t("errors.<key>")`.

Reads in server components call DAL read functions directly after `requireUser()` / `requireRole()`.

## Why the DAL is the security boundary

Auth is Better Auth (not Supabase Auth), so Postgres RLS cannot know who the user is. All DB access is server-side as the `postgres` role. RLS is enabled with no policies purely to close Supabase's public REST API. Every DAL function therefore authorizes before touching data. Building blocks in `src/server/session.ts` (`requireRole`, `canAccessStudent`, `isParentOf`, `isTutorOf`) and `src/server/access.ts` (paid content).

## Roles and relationships

- `user.role`: `admin | tutor | parent | student` (Better Auth admin plugin field).
- Children are `student` users with `isManagedChild = true`, created by a parent (username + 6-digit PIN, synthetic `@kids.invalid` email), linked in `parent_children`.
- Tutors teach students directly (`tutor_students`) or via class groups (`class_groups` + `class_group_members`).
- `canAccessStudent(actor, studentId)`: self, parent of, tutor of, or admin.

## Paid access

One rule in `src/server/access.ts` (`decideAccess`): free course, or staff, or an active admin grant (`access_grants`, the WhatsApp/IBAN path), or an active subscription seat (`subscription_seats` of an active iyzico or manual subscription whose plan covers the program). See `docs/billing.md`.

## Background work

`enqueueJob(kind, payload, { dedupeKey })` inserts into `jobs`. The worker (`apps/render-worker/src/index.ts`) claims one job at a time, reports progress, retries with exponential backoff (max attempts per job), and re-queues jobs whose worker died (stale lock after 30 min). Handlers live in `apps/render-worker/src/handlers/` and register in `register.ts`.

## Cron (Vercel)

`apps/web/vercel.json`: billing (expiries + reminders, daily), live (class reminders + auto-end, every 15 min), homework (due-soon reminders, hourly), digest (weekly parent email). Each route requires `Authorization: Bearer $CRON_SECRET` and fails closed without it.

## i18n

`next-intl`, locale-prefixed routes (`/en`, `/ar`, `/tr`), messages in `apps/web/messages/*.ts` (`en.ts` is the typed source of truth). DB content uses `I18nText` JSONB (`{ en, ar?, tr? }`). Notifications store a message key + params so they render in the reader's language. Arabic is RTL (`dir` set in the root layout); layouts use logical CSS properties only.

## Feature flags and rate limits

- Flags: `feature_flags` table + defaults in `src/server/flags.ts`; toggled at *Admin > Feature flags*. Gate optional features: AI studio, AI recitation feedback, live video, iyzico, manual payments, placement, gamification, certificates, messaging, weekly digest.
- Rate limits: Postgres sliding window (`rate_limit_buckets`) via `src/server/rate-limit.ts`; Better Auth has its own limiter on auth routes (DB storage).

## Child safety (summary)

Enforced in the DAL, not the UI: no tutor-to-minor messaging (`lib/messaging-guard.ts`), parental consent (`parental_consents`, `childAllows()`) gates live video, recitation recording and AI feedback for managed children, minors show first names only, private buckets with signed URLs, students can't enter a LiveKit room before the tutor, sessions are never recorded, AI feedback is advisory, data export/deletion flows.

Self-registered students aged 13 to 17 consent for themselves (no parental consent record). Confirm this policy with the client and a lawyer (KVKK/GDPR).
