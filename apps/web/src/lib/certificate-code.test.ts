import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, firstName, formatCode, generateCode, normalizeCode, recipientNameFor } from "./certificate-code";

describe("certificate codes", () => {
  it("generates the XXXX-XXXX-XX shape from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{2}$/);
      for (const ch of code.replace(/-/g, "")) expect(CODE_ALPHABET).toContain(ch);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it("rejects out-of-range bytes (uniformity) and is deterministic for a fixed stream", () => {
    const stream = [255, 250, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    let i = 0;
    const code = generateCode(() => stream[i++]!);
    expect(code).toBe(formatCode("ABCDEFGHJK"));
  });

  it("normalizes loose input and rejects invalid codes", () => {
    expect(normalizeCode("k7mp 2xq9 ht")).toBe("K7MP-2XQ9-HT");
    expect(normalizeCode("K7MP2XQ9HT")).toBe("K7MP-2XQ9-HT");
    expect(normalizeCode("K7MP-2XQ9")).toBeNull();
    expect(normalizeCode("K7MP-2XQ9-H0")).toBeNull();
  });

  it("shows first names only for minors and for public verification", () => {
    expect(recipientNameFor("Yusuf Ali Demir", true)).toBe("Yusuf");
    expect(recipientNameFor("  Yusuf   Ali ", false)).toBe("Yusuf Ali");
    expect(firstName("Ayse Yilmaz")).toBe("Ayse");
  });
});
