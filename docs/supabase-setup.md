# Connecting Supabase (and everything else)

The code is complete but has **never been connected to a database**. This is the checklist to bring it to life. Do the steps in order; each one is safe to re-run.

## 0. Prerequisites

- Node 22+ and pnpm 9 (`corepack enable`), then `pnpm install` at the repo root.
- Copy `.env.example` to `.env` **at the repo root** (one `.env` is shared by the web app, db scripts and the render worker).

## 1. Create the Supabase project

1. supabase.com, new project. Region close to users (e.g. Frankfurt `eu-central-1` for Turkey/Europe).
2. Save the database password somewhere safe.

## 2. Fill in `.env`

From **Project Settings > Database > Connection string**:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | **Transaction pooler** URI, port **6543** (used by the app at runtime; prepared statements are disabled in code for this). |
| `DIRECT_DATABASE_URL` | **Direct** connection URI, port **5432** (used only for migrations / RLS script). If your network has no IPv6, use the **Session pooler** URI instead. |

From **Project Settings > API**:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` secret. **Server only.** Never prefix with `NEXT_PUBLIC_`. |

Also set now:

- `BETTER_AUTH_SECRET`: `openssl rand -base64 32`
- `APP_URL` and `BETTER_AUTH_URL`: `http://localhost:3000` locally, the real domain in production.
- `CRON_SECRET`, `WORKER_SECRET`: any long random strings.

We do **not** use Supabase Auth. Auth is Better Auth, storing users in our own tables. Leave Supabase Auth settings alone.

## 3. One command: migrate, lock down, seed, buckets

```bash
pnpm db:setup
```

Which runs, in order:

1. `pnpm db:migrate`: applies `packages/db/migrations/*.sql`.
2. `pnpm db:rls`: enables Row Level Security on every table and revokes the `anon` / `authenticated` roles. The app only talks to Postgres from the server as the `postgres` role, so this just closes the public PostgREST API. **Re-run after every future migration that adds tables.**
3. `pnpm db:seed`: demo data (idempotent). Downloads the Quran text from Tanzil on first run (see `docs/quran-text.md`).
4. `pnpm storage:setup`: creates the Storage buckets (public: `public-assets`, `avatars`; private: `lesson-videos`, `lesson-assets`, `receipts`, `recitations`, `tts-audio`, `certificates`, `exports`).

## 4. Smoke test

```bash
pnpm dev
```

Demo accounts (password `Demo1234!` unless noted):

| Role | Login |
| --- | --- |
| Admin | `admin@demo.local` |
| Tutor | `tutor@demo.local` |
| Parent | `parent@demo.local` |
| Student (adult/teen) | `student@demo.local` |
| Child (managed by parent) | username `kid1`, PIN `123456` (Student username tab) |

Check, in this order:

1. Sign in as each role; you land on `/en/<role>`. `/ar/...` is right-to-left.
2. **Access flow:** as `kid1` open a paid lesson: locked. As admin go to *Access & payments > Give access*, grant `kid1` access to the Quran program for 30 days. As `kid1` the lesson now plays (needs a video file; upload one to `lesson-videos` and set the lesson's video path in the course editor). Revoke the grant: locked again.
3. **Manual payment:** as parent, *Billing > Pay by bank transfer*, pick a plan, upload any PDF as a receipt. As admin approve it in *Access & payments > Pending payments*. Parent and child get notifications.
4. Change your **production** `.env` secrets before going live (demo passwords are public in this repo).

**Remove demo users in production**: either do not run the seed in production, or delete the `@demo.local` users from *Admin > Users* after verifying.

## 5. Optional integrations (each turns on independently)

| Feature | Variables | Notes |
| --- | --- | --- |
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Redirect URI: `<APP_URL>/api/auth/callback/google` |
| Gemini (AI studio, TTS, recitation feedback) | `GEMINI_API_KEY` | Model ids in `GEMINI_*_MODEL` |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` | Verify the sending domain in Resend. Without it, emails are printed to the server console. |
| Card payments | `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_BASE_URL` | Sandbox first. Also create pricing plans in iyzico and paste each plan's reference code into *Admin > Plans*. Then turn on the `iyzico_checkout` flag. Webhook URL: `<APP_URL>/api/webhooks/iyzico`. **Verify webhook event names and signature field order against the iyzico docs before going live** (see `docs/billing.md`). |
| Live classes | `LIVEKIT_URL`, `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | LiveKit Cloud project. Webhook URL: `<APP_URL>/api/webhooks/livekit`. |
| Error tracking | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | No-op when unset. |

## 6. Deploy

- **Web**: Vercel, root directory `apps/web`, install command `pnpm install` (monorepo detected). Add all env vars. Crons in `apps/web/vercel.json` call `/api/cron/*` with `Authorization: Bearer $CRON_SECRET` (Vercel sends this automatically when `CRON_SECRET` is set).
- **Render worker**: NOT serverless (Remotion needs Chrome + ffmpeg). Any always-on container host (Railway, Fly.io, a small VPS). Command: `pnpm install && pnpm worker`. Same `.env`. See `docs/ai-video-pipeline.md`.
