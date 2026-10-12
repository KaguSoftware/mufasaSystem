# API surface

## Route handlers (`apps/web/src/app/api`)

| Route | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/auth/[...all]` | GET, POST | Better Auth | Sign in/up, sessions, OTP, 2FA, admin plugin. Returns 503 until DB + `BETTER_AUTH_SECRET` exist. |
| `/api/studio/chat` | POST (stream) | tutor/admin, flag `ai_studio`, limit `ai.chat` | AI studio chat with Gemini, streams text |
| `/api/live/token` | POST | session, limit `live.token` | LiveKit token or external meeting URL (all child-safety gates in `joinSession`) |
| `/api/billing/iyzico/callback` | POST/GET | iyzico token | Checkout result, activates the first period |
| `/api/webhooks/iyzico` | POST | V3 signature | Subscription renewals/failures/cancellations |
| `/api/webhooks/livekit` | POST | LiveKit JWT | Attendance from join/leave, room finished |
| `/api/cron/billing` | GET | `Bearer CRON_SECRET` | Expire subscriptions, expiry reminders (daily) |
| `/api/cron/live` | GET | `Bearer CRON_SECRET` | Class reminders, auto-end sessions (every 15 min) |
| `/api/cron/homework` | GET | `Bearer CRON_SECRET` | Homework due-soon reminders (hourly) |
| `/api/cron/digest` | GET | `Bearer CRON_SECRET` | Weekly parent digest email (Sunday) |
| `/verify-cert/[code]` | GET | public | Redirects to `/en/verify/<code>` (link printed on certificate PDFs) |

## Server actions (`apps/web/src/server/actions`)

Every export is wrapped in `action()` (zod input, auth, role, flag, rate limit) and returns `ActionResult<T>`. Authorization of the specific object happens in the DAL function it calls.

| File | Actions |
| --- | --- |
| `access.ts` (admin) | searchUsersAction, getUserAccessAction, accessTargetsAction, grantAccessAction, extendGrantAction, revokeGrantAction, extendSubscriptionAction, cancelSubscriptionAction |
| `account.ts` | updateAccount, stopImpersonating |
| `admin-users.ts` (admin) | createStaff, setRole, ban, unban, impersonate, familyLinks |
| `announcements.ts` (admin) | saveAnnouncement, deleteAnnouncement |
| `billing.ts` | quotePayment, submitPaymentRequest, startCardCheckoutAction, getReceiptUrlAction, approvePaymentAction, rejectPaymentAction, savePlanAction, saveCouponAction, deleteCouponAction |
| `catalog.ts` (admin; tutors for lessons) | save/delete Program, Course, Unit, Lesson, LessonAsset, Quiz, Question; reorderAction, setPublishedAction |
| `certificates.ts` | getCertificateDownload, issueManualCertificate, revokeCertificate |
| `data-requests.ts` | requestData, reviewRequest |
| `family.ts` (parent) | createChild, updateChild, resetChildPin, updateConsent |
| `flags.ts` (admin) | upsertFlag |
| `hifz.ts` | create/update/delete Plan, create/update/delete Entry |
| `homework.ts` | createHomeworkAction, deleteHomeworkAction, reviewHomeworkSubmissionAction, submitFreeHomeworkAction, submitHomeworkQuizAction |
| `learn.ts` | enrollAction, recordProgressAction, markLessonCompleteAction |
| `live.ts` | groups (create/update/members), scheduleSessions, editSession, cancelSession, markAttendance, markAllPresent, moderateRoom, availability (weekly + exceptions), fetchSlots, requestBooking, respondToBooking, cancelBooking, fetchSessionDetail |
| `messages.ts` | startThread, sendMessage, markThreadRead |
| `notifications.ts` | markNotificationRead, markAllNotificationsRead |
| `placement.ts` | submitPlacementAction, enrollRecommendedAction |
| `quiz.ts` | submitQuizAction |
| `recitations.ts` | submitRecitationAction, requestAiFeedbackAction, reviewRecitationAction |
| `settings.ts` (admin) | updateSettingsAction |
| `signup.ts` | completeSignup, updateOwnProfile |
| `studio.ts` (tutor/admin) | conversations, scripts (save/update/approve), generateScenes, updateProjectScenes, voiceProject, renderProject, publishProject, getProjectStatus |

## Worker jobs (`apps/render-worker/src/handlers`)

| Kind | Handler | Enqueued by |
| --- | --- | --- |
| `tts_project` | `video.ts` | AI studio "Generate voice" |
| `render_video` | `video.ts` | AI studio "Render" |
| `recitation_ai` | `recitation-ai.ts` | Recitation upload (flag + consent) or retry |
| `certificate_pdf` | `certificate.ts` | Course completion / admin issue |
| `data_export` | `data-export.ts` | Privacy: export my data |
