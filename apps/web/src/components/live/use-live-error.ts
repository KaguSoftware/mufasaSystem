"use client";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/components/account/use-action-error";
import type { ErrorCode } from "@/server/errors";

/** Error codes the live module throws as AppError messages or field errors (messages: live.err.*). */
export const LIVE_ERRORS = [
  "tutor_busy",
  "slot_taken",
  "slot_past",
  "group_full",
  "already_member",
  "group_inactive",
  "session_not_editable",
  "session_over",
  "too_early",
  "tutor_not_joined",
  "no_meeting_url",
  "no_room",
  "not_livekit",
  "cannot_remove_self",
  "booking_not_pending",
  "consent_live_video",
  "https_required",
  "livekit_unavailable",
  "invalid_time",
  "in_the_past",
  "invalid_range",
  "invalid_ranges",
  "invalid_tutor",
  "not_student",
  "age_out_of_range",
  "age_range",
  "below_members",
] as const;
type LiveErr = (typeof LIVE_ERRORS)[number];

/** Maps an action/API error to the most specific localized message. */
export function useLiveError() {
  const t = useTranslations("live");
  const base = useErrorText();
  return (e: { code: ErrorCode; message?: string; fieldErrors?: Record<string, string[]> }) => {
    const candidates = [e.message, ...Object.values(e.fieldErrors ?? {}).flat()];
    for (const c of candidates) {
      if (c && (LIVE_ERRORS as readonly string[]).includes(c)) return t(`err.${c as LiveErr}`);
    }
    return base(e);
  };
}
