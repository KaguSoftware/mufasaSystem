import { describe, expect, it } from "vitest";
import { progressPercent } from "./progress";

describe("progressPercent", () => {
  it("prefers the server duration", () => {
    expect(progressPercent(50, 100, 5)).toBe(50);
    expect(progressPercent(500, 100, 600)).toBe(100);
  });
  it("falls back to a plausible client duration", () => {
    expect(progressPercent(30, null, 60)).toBe(50);
  });
  it("rejects tiny or inconsistent client durations", () => {
    expect(progressPercent(2, null, 2)).toBeNull();
    expect(progressPercent(100, null, 60)).toBeNull();
    expect(progressPercent(10, null, 0)).toBeNull();
  });
  it("rejects bad positions", () => {
    expect(progressPercent(-1, 100, 100)).toBeNull();
    expect(progressPercent(Number.NaN, 100, 100)).toBeNull();
  });
});
