import { describe, expect, it } from "vitest";
import {
  applyCoupon,
  extractReference,
  formatMoney,
  generateReferenceCode,
  periodEnd,
  REFERENCE_PATTERN,
  whatsappLink,
} from "./billing-math";

describe("applyCoupon", () => {
  it("applies percent", () => expect(applyCoupon(10000, { percentOff: 25 })).toEqual({ discountMinor: 2500, totalMinor: 7500 }));
  it("applies amount and never goes below zero", () => {
    expect(applyCoupon(1000, { amountOffMinor: 5000 })).toEqual({ discountMinor: 1000, totalMinor: 0 });
  });
  it("caps percent at 100", () => expect(applyCoupon(1000, { percentOff: 150 }).totalMinor).toBe(0));
  it("no coupon", () => expect(applyCoupon(1234, null)).toEqual({ discountMinor: 0, totalMinor: 1234 }));
});

describe("periodEnd", () => {
  const start = new Date("2026-01-31T00:00:00Z");
  it("uses periodDays", () => expect(periodEnd(start, { interval: "month", periodDays: 30 }).toISOString()).toBe("2026-03-02T00:00:00.000Z"));
  it("override wins", () => expect(periodEnd(start, { interval: "month", periodDays: 30 }, 10).toISOString()).toBe("2026-02-10T00:00:00.000Z"));
  it("falls back to interval", () => expect(periodEnd(new Date("2026-01-15T00:00:00Z"), { interval: "quarter", periodDays: 0 }).toISOString()).toBe("2026-04-15T00:00:00.000Z"));
});

describe("formatMoney", () => {
  it("formats TRY minor units", () => {
    expect(formatMoney(49900, "TRY", "en")).toContain("499");
    expect(formatMoney(49950, "USD", "en")).toBe("$499.50");
  });
});

describe("reference code", () => {
  it("matches the pattern and avoids ambiguous characters", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateReferenceCode();
      expect(c).toMatch(REFERENCE_PATTERN);
      expect(c.slice(4)).not.toMatch(/[01ILO]/);
    }
  });
  it("is deterministic with a seeded rng", () => {
    expect(generateReferenceCode(() => 0)).toBe("ACA-AAAA-22");
  });
  it("extracts from text", () => expect(extractReference("hi [ACA-7KQ2-95] note")).toBe("ACA-7KQ2-95"));
});

describe("whatsappLink", () => {
  it("builds a wa.me link", () => {
    expect(whatsappLink("+90 500 000 00 00", "a b")).toBe("https://wa.me/905000000000?text=a%20b");
  });
});

import { summarizeAccess } from "./billing-math";

describe("summarizeAccess", () => {
  const d = (s: string) => new Date(s);
  it("none", () => expect(summarizeAccess([], []).active).toBe(false));
  it("open-ended grant wins", () => expect(summarizeAccess([{ expiresAt: null }], [{ currentPeriodEnd: d("2030-01-01") }])).toEqual({ active: true, forever: true, until: null }));
  it("latest end", () => {
    const r = summarizeAccess([{ expiresAt: d("2030-01-01") }], [{ currentPeriodEnd: d("2031-01-01") }]);
    expect(r.until?.toISOString()).toBe("2031-01-01T00:00:00.000Z");
  });
});
