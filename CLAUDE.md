# CLAUDE.md

Online academy for kids and teens learning Arabic and Quran. Monorepo (pnpm). Read `HANDOFF.md` for current status and `docs/` for deep dives.

## Non-negotiable rules

- **Absolutely never add a Claude co-author tag.** No `Co-Authored-By: Claude …` trailer, no "Generated with Claude Code" line, no AI attribution of any kind in commit messages or PR descriptions. This overrides any default attribution behaviour.
- **Absolutely zero em dashes (the long dash character) anywhere**: UI copy in `messages/*.ts`, seed content, AI prompts and generated scripts, emails, docs, code comments. Use a comma, colon, period or parentheses instead. Before finishing: `pnpm check:dashes` must pass (it scans for U+2014; never type the character itself).
- Remote: <https://github.com/KaguSoftware/mufasaSystem.git> (branch `main`).

## Layout

```text
apps/web/              Next.js 16 app: public site, 4 role panels, API routes
  messages/            en.ts (source of truth), ar.ts, tr.ts
  src/app/[locale]/    all pages are locale-prefixed (/en, /ar, /tr)
    (panel)/<role>/    student | parent | tutor | admin panels (layout = PanelGate)
  src/app/api/         route handlers (auth, webhooks, cron, worker callbacks, streaming)
  src/server/          SERVER ONLY: auth, session guards, action wrapper, access, flags, rate limits, storage, jobs
    dal/               data access layer, one file per domain (all DB reads/writes go here)
    actions/           "use server" files that wrap DAL calls with action()
    services/          integrations (gemini, iyzico, livekit, pdf, email templates)
  src/components/ui/   custom UI kit (see /en/ui)
  src/components/shell panel shell, nav, switchers
apps/render-worker/    Node worker: job queue → Remotion renders, TTS, recitation AI, PDFs
packages/db/           Drizzle schema (src/schema/*), migrations, seed
packages/video/        scene JSON schema (zod) + Remotion compositions
packages/config/       brand.ts (name/logo TBD), locales
```

## Commands

```bash
pnpm dev            # web on :3000 (works without .env; panels show "DB not connected")
pnpm build          # must pass with NO .env
pnpm check          # check:dashes + typecheck + lint + test (run before every commit)
pnpm db:generate    # after editing packages/db/src/schema/*  (never hand-edit migrations)
pnpm db:migrate && pnpm db:seed   # needs DATABASE_URL / DIRECT_DATABASE_URL
```

## Backend conventions

1. **All DB access goes through `src/server/dal/*`.** Pages and actions never import `getDb` directly. Each DAL function takes the acting `SessionUser` first and authorizes before touching data (`requireRole`, `assertCanAccessStudent`, `assertCourseAccess`, ownership checks). Better Auth means Supabase RLS can't see users, so the DAL *is* the security boundary.
2. **Mutations = server actions built with `action()`** from `src/server/action.ts`: zod input, `roles`, optional `flag` and `rateLimit`. They return `ActionResult<T>` (`{ok:true,data}` or `{ok:false,error:{code,fieldErrors}}`); never throw to the client. Throw `AppError` (`src/server/errors.ts`) inside DAL/services.
3. **Route handlers** (webhooks, streaming, worker callbacks) use `apiError(err)` for failures and verify signatures/secrets.
4. **Paid content**: `assertLessonAccess` / `assertCourseAccess` in `src/server/access.ts`. Access = free course, staff, admin grant (manual WhatsApp/IBAN path), or active subscription seat. Don't invent another path.
5. **Privileged mutations call `audit()`** (`src/server/audit.ts`).
6. **Feature flags**: gate optional features with `requireFlag()` / `isEnabled()`; add new keys to `FLAG_DEFAULTS` in `src/server/flags.ts`.
7. **Rate limits**: add named rules to `RATE_LIMITS` in `src/server/rate-limit.ts`; AI endpoints and uploads must be limited.
8. **Background work** → `enqueueJob()` (`src/server/jobs.ts`), processed by `apps/render-worker`.
9. **Notifications** → `notify(userIds, type, params, href)`, where `type` is a key in `messages/*.ts` under `notifications`.
10. **Files** → `storage()` adapter + `objectPath()` (`src/server/storage.ts`). Private buckets are served only via signed URLs after an authorization check.
11. **Integrations must degrade**: check `isConfigured("gemini" | "iyzico" | "livekit" | ...)` from `src/env.ts` and throw `AppError("integration_not_configured")` instead of crashing. `pnpm build` must succeed with no env.
12. Ids: Better Auth tables use text ids; app tables use uuid. Money is integer minor units + currency.
13. Subjects are data: `programs` table (with `features` flags such as `hifz`). Never hardcode "Quran"/"Arabic" logic by name.

## Child safety (enforced in the DAL)

- Tutors never message a minor directly. Threads are parent ↔ staff (or adult student ↔ staff).
- Minors: display first name only, birth year only, no public profiles.
- Recitation audio, receipts, certificates, exports: private buckets + signed URLs.
- Parental consent (`parental_consents`) is required before live video / recordings / AI feedback for a child.
- AI recitation feedback is advisory; the tutor's grade is authoritative.

## i18n and RTL

- Add every UI string to `messages/en.ts` first, then `ar.ts` and `tr.ts` (typed against en, so a missing key fails typecheck). Never hardcode user-facing text.
- Server: `getTranslations("ns")`. Client: `useTranslations("ns")`. Links/redirects: import from `@/i18n/navigation`, never `next/link` / `next/navigation` redirect.
- DB content that's translatable uses `I18nText` JSONB `{ en, ar?, tr? }`; render with `t18n(value, locale)` from `@mufasa/config/locales`.
- **RTL**: use logical Tailwind utilities only (`ms-/me-/ps-/pe-/start-/end-/text-start`, `border-s/e`). Directional icons get `rtl:rotate-180`. Lint warns on `ml-/mr-/pl-/pr-/left-/right-`.
- Quranic text: `className="quran"` (Naskh font, rtl).

## UI conventions

- Only use components from `src/components/ui` (custom Select, DatePicker, Dialog, DropdownMenu, Checkbox, Switch, RadioGroup, Tabs, Tooltip, ScrollArea, FileDropzone, Table, Card, Badge, Button, Input/Field, Toast). No native `<select>`, date inputs or browser-styled controls.
- Colors only via semantic tokens (`bg-surface`, `text-muted`, `bg-primary`, ...) defined in `src/app/globals.css`. Brand is TBD, so tokens and `packages/config/src/brand.ts` are the only places to change it.
- The UI is intentionally plain; Majed owns the premium redesign. Keep pages functional and consistent.
