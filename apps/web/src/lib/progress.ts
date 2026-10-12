/** Minimum client-reported duration accepted when the server has no stored duration. */
export const MIN_CLIENT_DURATION_SEC = 30;
/** Slack allowed between position and duration (player rounding). */
export const POSITION_SLACK_SEC = 5;

/**
 * Watch percent 0..100. The server-side duration wins when present; the client duration is
 * only a fallback and must look plausible. Returns null when the report must be rejected.
 */
export function progressPercent(
  positionSec: number,
  serverDurationSec: number | null | undefined,
  clientDurationSec: number | null | undefined,
): number | null {
  if (!Number.isFinite(positionSec) || positionSec < 0) return null;
  let duration: number;
  if (serverDurationSec && serverDurationSec > 0) {
    duration = serverDurationSec;
  } else {
    const c = clientDurationSec ?? 0;
    if (!Number.isFinite(c) || c < MIN_CLIENT_DURATION_SEC) return null;
    if (positionSec > c + POSITION_SLACK_SEC) return null;
    duration = c;
  }
  return Math.max(0, Math.min(100, (positionSec / duration) * 100));
}
