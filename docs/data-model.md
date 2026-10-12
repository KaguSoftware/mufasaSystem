# Data model

Source of truth: `packages/db/src/schema/*.ts` (Drizzle, snake_case columns). After editing a schema file run `pnpm db:generate`, commit the new migration, then `pnpm db:migrate` and `pnpm db:rls`. Never hand-edit migrations.

Conventions: Better Auth tables use text ids; app tables use uuid. Translatable text is JSONB `I18nText` `{ en, ar?, tr? }`. Money is integer minor units + currency. Timestamps are `timestamptz`.

| Domain (file) | Tables | Notes |
| --- | --- | --- |
| Auth (`auth.ts`) | `user`, `session`, `account`, `verification`, `two_factor`, `rate_limit` | Better Auth. `user.role`, `locale`, `timezone`, `is_managed_child`, `username`. Do not rename fields. |
| People (`people.ts`) | `profiles`, `parent_children`, `tutor_profiles`, `tutor_students`, `parental_consents`, `data_requests` | Birth year only (no full dates). Consents are versioned rows; the latest non-revoked one applies. |
| Catalog (`catalog.ts`) | `programs`, `courses`, `units`, `lessons`, `lesson_assets`, `quizzes`, `quiz_questions`, `quiz_attempts`, `placement_rules` | Programs are admin-defined subjects with `features` flags (hifz, recitation, liveClasses, placement). `lessons.context` feeds the AI studio. |
| Progress (`progress.ts`) | `enrollments`, `lesson_progress`, `xp_events`, `streaks`, `badges`, `user_badges`, `certificates`, `homework`, `homework_submissions` | XP is idempotent via unique `(user_id, ref_key)`. Badge rules are JSON (`BadgeRule`). |
| Quran and hifz (`hifz.ts`) | `quran_surahs`, `quran_ayahs`, `hifz_plans`, `hifz_entries`, `recitation_submissions`, `recitation_ai_feedback` | `quran_ayahs.text_uthmani` is verbatim Tanzil text (never modify). AI feedback is advisory. |
| Live (`live.ts`) | `class_groups`, `class_group_members`, `class_sessions`, `session_attendees`, `tutor_availability_exceptions`, `bookings` | `class_sessions.mode` = `livekit` or `external_link`. Attendance can be set by tutor or LiveKit webhook. |
| Billing (`billing.ts`) | `plans`, `subscriptions`, `subscription_seats`, `payments`, `manual_payment_requests`, `coupons`, `access_grants` | `subscriptions.source` = `iyzico` or `manual`. Seats say which learners a subscription covers. Grants are admin overrides. |
| AI (`ai.ts`) | `ai_conversations`, `ai_messages`, `scripts`, `mascots`, `video_projects`, `jobs` | `jobs` is the worker queue (status, progress, attempts, run_after, dedupe_key). |
| Ops (`ops.ts`) | `announcements`, `notifications`, `message_threads`, `message_thread_members`, `messages`, `audit_log`, `settings`, `feature_flags`, `rate_limit_buckets` | Notifications store a message key + params. `settings` is typed in `apps/web/src/server/dal/settings.ts`. |

## Seed

`pnpm db:seed` runs the steps in `packages/db/src/seed/steps.ts` in order (all idempotent): flags, demo users (one per role + a managed child), 114 surahs, Quran text (6236 ayahs), programs, demo courses with quizzes and a placement test, badges, plans and default settings.
