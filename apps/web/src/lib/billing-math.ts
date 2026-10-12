/** Pure billing helpers (no server imports, safe on the client). */

export type CouponLike = { percentOff?: number | null; amountOffMinor?: number | null };

/** Applies a coupon to a price in minor units. Never goes below 0. */
export function applyCoupon(priceMinor: number, coupon?: CouponLike | null) {
  const price = Math.max(0, Math.round(priceMinor));
  let discount = 0;
  if (coupon?.percentOff) discount = Math.round((price * Math.min(100, Math.max(0, coupon.percentOff))) / 100);
  else if (coupon?.amountOffMinor) discount = Math.max(0, Math.round(coupon.amountOffMinor));
  discount = Math.min(price, discount);
  return { discountMinor: discount, totalMinor: price - discount };
}

export type IntervalLike = { interval: "month" | "quarter" | "year" | "one_time"; periodDays: number };

const MONTHS: Record<IntervalLike["interval"], number> = { month: 1, quarter: 3, year: 12, one_time: 0 };

/**
 * End of a period starting at `start`. A positive `periodDays` (override or plan value)
 * always wins and adds that many days. Otherwise the calendar interval is used.
 */
export function periodEnd(start: Date, plan: IntervalLike, overrideDays?: number | null): Date {
  const days = overrideDays && overrideDays > 0 ? overrideDays : plan.periodDays;
  const d = new Date(start);
  if (days > 0) {
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }
  d.setUTCMonth(d.getUTCMonth() + (MONTHS[plan.interval] || 1));
  return d;
}

/** Formats minor units for a locale and currency (TRY/USD/EUR all have 2 decimals). */
export function formatMoney(minor: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ"; // no I, L, O
const DIGITS = "23456789"; // no 0, 1
export const REFERENCE_PATTERN = /^ACA-[A-HJKMNP-Z][A-HJKMNP-Z2-9]{3}-[2-9]{2}$/;

/** Short, unambiguous payment reference, e.g. ACA-7KQ2-95 (digits 0/1 and letters I/L/O never appear). */
export function generateReferenceCode(rand: () => number = Math.random): string {
  const pick = (alphabet: string) => alphabet[Math.floor(rand() * alphabet.length) % alphabet.length]!;
  const first = pick(LETTERS);
  const mid = Array.from({ length: 3 }, () => pick(LETTERS + DIGITS)).join("");
  const tail = pick(DIGITS) + pick(DIGITS);
  return `ACA-${first}${mid}-${tail}`;
}

/** Extracts a reference code from free text (used to read it back from a request note). */
export function extractReference(text: string | null | undefined): string | null {
  const m = text?.match(/ACA-[A-Z2-9]{4}-[2-9]{2}/);
  return m ? m[0] : null;
}

/** wa.me deep link. `number` may contain +, spaces or dashes. */
export function whatsappLink(number: string, message: string): string {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

/** Collapses active grants + subscription seats into one status line for UI. */
export function summarizeAccess(
  grants: { expiresAt: Date | null }[],
  seats: { currentPeriodEnd: Date | null }[],
): { active: boolean; forever: boolean; until: Date | null } {
  if (!grants.length && !seats.length) return { active: false, forever: false, until: null };
  if (grants.some((g) => !g.expiresAt)) return { active: true, forever: true, until: null };
  const times = [...grants.map((g) => g.expiresAt), ...seats.map((s) => s.currentPeriodEnd)]
    .filter((d): d is Date => Boolean(d))
    .map((d) => d.getTime());
  return { active: true, forever: false, until: times.length ? new Date(Math.max(...times)) : null };
}
