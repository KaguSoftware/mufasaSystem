import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("accepts same-origin paths", () => {
    expect(safeNext("/en/admin")).toBe("/en/admin");
    expect(safeNext("/en/parent?x=1")).toBe("/en/parent?x=1");
  });
  it("rejects external and malformed values", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "", null, undefined, "evil"]) {
      expect(safeNext(bad as string | null | undefined)).toBeNull();
    }
  });
});
