import { describe, expect, it } from "vitest";
import {
  isHttpsUrl,
  isWithinJoinWindow,
  localDateTimeToUtc,
  recurringStarts,
  tokenTtlSeconds,
  windowState,
} from "./live-window";

const start = new Date("2026-10-12T10:00:00Z");

describe("join window", () => {
  it("opens 15 minutes before the start and closes at the end", () => {
    expect(windowState(start, 45, new Date("2026-10-12T09:44:00Z"))).toBe("too_early");
    expect(windowState(start, 45, new Date("2026-10-12T09:45:00Z"))).toBe("open");
    expect(windowState(start, 45, new Date("2026-10-12T10:45:00Z"))).toBe("open");
    expect(windowState(start, 45, new Date("2026-10-12T10:46:00Z"))).toBe("closed");
    expect(isWithinJoinWindow(start, 45, new Date("2026-10-12T10:30:00Z"))).toBe(true);
  });
  it("token ttl runs until end plus 15 minutes", () => {
    expect(tokenTtlSeconds(start, 45, new Date("2026-10-12T09:45:00Z"))).toBe(75 * 60);
  });
  it("token ttl never drops below five minutes", () => {
    expect(tokenTtlSeconds(start, 45, new Date("2026-10-13T00:00:00Z"))).toBe(300);
  });
});

describe("recurringStarts", () => {
  it("creates one row per week at the same local time", () => {
    const r = recurringStarts("2026-10-12T17:00", "Europe/Istanbul", 3);
    expect(r.map((d) => d.toISOString())).toEqual([
      "2026-10-12T14:00:00.000Z",
      "2026-10-19T14:00:00.000Z",
      "2026-10-26T14:00:00.000Z",
    ]);
  });
  it("keeps the wall time across a DST change", () => {
    const r = recurringStarts("2026-10-25T17:00", "America/New_York", 2);
    expect(r.map((d) => d.toISOString())).toEqual(["2026-10-25T21:00:00.000Z", "2026-11-01T22:00:00.000Z"]);
  });
  it("clamps the number of weeks", () => {
    expect(recurringStarts("2026-10-12T17:00", "Europe/Istanbul", 0)).toHaveLength(1);
    expect(recurringStarts("2026-10-12T17:00", "Europe/Istanbul", 500)).toHaveLength(52);
  });
});

describe("helpers", () => {
  it("rejects malformed local date times", () => {
    expect(localDateTimeToUtc("2026-10-12 17:00", "Europe/Istanbul")).toBeNull();
  });
  it("only accepts https links", () => {
    expect(isHttpsUrl("https://meet.google.com/abc-defg-hij")).toBe(true);
    expect(isHttpsUrl("http://meet.google.com/x")).toBe(false);
    expect(isHttpsUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpsUrl("not a url")).toBe(false);
  });
});
