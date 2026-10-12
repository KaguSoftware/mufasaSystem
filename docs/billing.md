# Billing and access

Two ways to pay, one access rule.

## 1. Manual: bank transfer (IBAN) + WhatsApp (expected main path)

1. Parent (or a student 13+) opens *Billing*, picks a plan and the learners it covers (up to `plan.seats`), optional coupon.
2. The server computes the amount and a **reference code** (`ACA-XXXX-NN`, stored in `manual_payment_requests.reference_code`). The dialog shows the IBAN details from *Admin > Settings* and a WhatsApp deep link with a prefilled message (plan, amount, reference).
3. Optional receipt upload (PDF/image, 10 MB, private `receipts` bucket).
4. Admin: *Access & payments > Pending payments*: view receipt (5-minute signed URL), **approve** (optionally override the period length) or **reject** with a reason.
5. Approval (one transaction, row-locked): creates a `subscriptions` row (`source = manual`, active), `subscription_seats` for each learner, a `payments` row, counts the coupon redemption (re-checking its cap under lock), links the request. Renewals stack: the new period starts when the learner's current manual subscription to the same plan ends.
6. Notifications to payer and learners; `audit_log` entry.

### Direct grants (no request needed)

*Access & payments > Give access*: search any user, then grant access to **all content, a program, or one course**, with an expiry or forever (`access_grants`). Extend or revoke later. This is how staff handle someone who paid on WhatsApp without using the form.

## 2. Card: iyzico subscriptions (behind flag `iyzico_checkout`, off by default)

- Checkout form initialize → hosted form → callback `/api/billing/iyzico/callback` activates the first period.
- Renewals/failures/cancellations arrive at `/api/webhooks/iyzico`, verified with the V3 signature (HMAC-SHA256, constant-time compare), idempotent per order reference.
- iyzico requires the payer's 11-digit identity number (TC Kimlik) for Turkish cards; the card dialog collects it.

**Before enabling in production (unverified, written from docs memory):**

- the webhook event type names (`order.success`, `order.failure`, cancel events);
- the V3 signature field order (`webhookSignatureMessage` in `src/server/services/iyzico.ts`: secret + eventType + subscriptionReferenceCode + orderReferenceCode + customerReferenceCode).

Test both in the iyzico sandbox; the unit test only proves our own consistency.

## The access rule

`src/server/access.ts` `decideAccess()`: free course, or staff (admin/tutor), or an active grant covering the course/program/all, or an active seat whose plan covers the program (`plans.program_ids` empty = everything). Lessons marked *preview* are always open. Every lesson, progress and quiz path calls `assertLessonAccess`.

## Cron `/api/cron/billing` (daily)

- Marks subscriptions past their period end as `expired`.
- Sends "access expiring" reminders N days before the end (`billing.reminderDaysBefore`, default 3) for subscriptions (deduped by `expiry_reminder_sent_at`) and grants (sent on the exact day match, so once per daily run).

## Money

Integers in minor units (kuruş/cents) + currency. Formatting: `formatMoney` in `src/lib/billing-math.ts`.

## Known follow-ups

- Payment notifications store the plan name in English in their params; render-time localization would be nicer.
- No invoices/e-Arşiv integration (Turkish e-invoice) yet. Ask the client's accountant.
