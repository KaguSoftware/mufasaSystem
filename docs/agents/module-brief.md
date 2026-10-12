# Module brief (for Claude Code sub-agents and future sessions)

You are building one module of an online Arabic & Quran academy for kids and teens. The foundation is done. Read these first, in this order:

1. `/CLAUDE.md` (rules and conventions, mandatory)
2. `packages/db/src/schema/*` (the tables for your module already exist)
3. `apps/web/src/server/{action,session,access,flags,rate-limit,audit,jobs,notify,storage,errors}.ts` (reuse them, don't reinvent)
4. `apps/web/src/components/ui/*` and `/en/ui` showcase (`src/app/[locale]/ui/showcase.tsx`) for UI usage
5. `apps/web/src/components/shell/nav.tsx` (sidebar routes per role)

## Hard rules

- **Zero em dashes (U+2014)** in anything you write: copy, comments, prompts, seed data. Run `node scripts/check-dashes.mjs` from the repo root before finishing.
- **Never commit** and never touch git. The lead reviews and commits.
- **Do not install packages.** Everything needed is installed (check `apps/web/package.json`). If something is truly missing, say so in your report instead.
- **Do not run `next build` or `next dev`** (other agents share the folder). Use `npx tsc --noEmit -p apps/web/tsconfig.json`, `npx eslint <your files>` (from apps/web) and `npx vitest run <your tests>`.
- Other agents are editing other modules **at the same time** in this working tree. Only edit files in your scope. If typecheck shows errors in files outside your scope, ignore them and mention them in your report. Never "fix" or reformat another module's files.
- Shared files you MAY edit, carefully, with small targeted Edit calls (re-read right before editing because others edit them too):
  - `apps/web/messages/{en,ar,tr}.ts`: ONLY inside your own namespace block(s) (listed in your task). Replace the `_placeholder: ""` line with your keys. Write real Arabic and Turkish, not English copies. Keep the three files in the same key order.
  - `apps/web/src/server/flags.ts` (add to `FLAG_DEFAULTS`) and `apps/web/src/server/rate-limit.ts` (add to `RATE_LIMITS`) only if your task needs a new key.
  - `apps/web/src/components/shell/nav.tsx` only if your task says so.
- Database schema changes: avoid. If unavoidable, edit the schema file for your domain only, then explain exactly what and why in your report (the lead regenerates migrations). Do not run drizzle-kit.
- No DB is connected. Code must compile and be correct by construction; you cannot run queries. Pages must still render (PanelGate handles the no-DB case for panels; public pages that read the DB must catch `DbNotConfiguredError` / check `isDbConfigured()` and show an empty state).

## Patterns to follow

- `src/server/dal/<domain>.ts`: `import "server-only"`; functions take `(actor: SessionUser, ...)`, authorize first, then query with Drizzle (`getDb()`, `schema`, operators from `@mufasa/db`).
- `src/server/actions/<domain>.ts`: `"use server"`; each export is `action({ input: zodSchema, roles, flag?, rateLimit? }, async (input, { user }) => dal.fn(user, input))`. Call `revalidatePath` where useful.
- Pages: server components under `src/app/[locale]/(panel)/<role>/...` that call DAL read functions via `requireUser()`/`requireRole()`. Interactive bits are small client components next to the page (`_components/*.tsx`) that call actions and show `toast` on result. Map `error.code` to `t("errors.<key>")` via `errorMessageKey` from `src/server/errors.ts` (safe to import on client: it has no server-only imports).
- Translatable DB fields are `I18nText`; render with `t18n(value, locale)`.
- Admin-only mutations call `audit()`.
- Pure logic (scoring, date math, rules) goes in a separate pure module with a `*.test.ts` next to it (Vitest, `src/**/*.test.ts`).
- Keep UI plain and consistent with the kit. RTL-safe logical classes only.

## Report back (final message)

1. Files created/changed (grouped).
2. What works end-to-end vs. what is stubbed and why.
3. Any schema change needed (exact diff) or missing dependency.
4. Typecheck/lint/test status for your files, and any errors you saw in other modules' files.
5. Message namespaces you filled.
