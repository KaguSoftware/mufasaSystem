import { describe, expect, it } from "vitest";
import { canSelfSignup, firstNameOnly, isMinor } from "./minor";

const now = new Date("2026-10-12T00:00:00Z");

describe("isMinor", () => {
  it("managed children are always minors", () => {
    expect(isMinor({ isManagedChild: true, birthYear: 1980 }, now)).toBe(true);
  });
  it("uses age under 18", () => {
    expect(isMinor({ birthYear: 2010, role: "student" }, now)).toBe(true);
    expect(isMinor({ birthYear: 2008, role: "student" }, now)).toBe(false);
    expect(isMinor({ birthYear: 1990, role: "parent" }, now)).toBe(false);
  });
  it("unknown birth year: students are minors, others adults", () => {
    expect(isMinor({ role: "student" }, now)).toBe(true);
    expect(isMinor({ birthYear: null, role: "student" }, now)).toBe(true);
    expect(isMinor({ role: "parent" }, now)).toBe(false);
    expect(isMinor({ role: "tutor" }, now)).toBe(false);
  });
});

describe("canSelfSignup", () => {
  it("requires 13+", () => {
    expect(canSelfSignup(2013, 13, now)).toBe(true);
    expect(canSelfSignup(2014, 13, now)).toBe(false);
  });
  it("rejects implausible years", () => {
    expect(canSelfSignup(1800, 13, now)).toBe(false);
    expect(canSelfSignup(2030, 13, now)).toBe(false);
  });
});

describe("firstNameOnly", () => {
  it("keeps only the first token", () => {
    expect(firstNameOnly("  Omar  Al Farouq ")).toBe("Omar");
    expect(firstNameOnly("Aya")).toBe("Aya");
    expect(firstNameOnly("")).toBe("");
    expect(firstNameOnly(null)).toBe("");
  });
});
