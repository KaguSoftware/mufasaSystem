import { describe, expect, it } from "vitest";
import { canStartThread, checkThreadMembers, type MsgRole, type Party } from "./messaging-guard";

const p = (id: string, role: MsgRole, isMinor = false): Party => ({ id, role, isMinor });
const roles: MsgRole[] = ["admin", "tutor", "parent", "student"];

describe("checkThreadMembers", () => {
  it("never allows a minor", () => {
    for (const r of roles) {
      expect(checkThreadMembers([p("a", "tutor"), p("m", r, true)])).toEqual({ ok: false, reason: "minor_participant" });
    }
  });
  it("requires one staff and one non-staff", () => {
    expect(checkThreadMembers([p("a", "tutor"), p("b", "admin")])).toEqual({ ok: false, reason: "same_side" });
    expect(checkThreadMembers([p("a", "parent"), p("b", "student")])).toEqual({ ok: false, reason: "same_side" });
    expect(checkThreadMembers([p("a", "tutor"), p("b", "parent")]).ok).toBe(true);
    expect(checkThreadMembers([p("a", "admin"), p("b", "student")]).ok).toBe(true);
  });
});

describe("canStartThread over all role pairs", () => {
  for (const a of roles) {
    for (const b of roles) {
      for (const teaches of [true, false]) {
        it(`${a} -> ${b} (teaches=${teaches})`, () => {
          const res = canStartThread({ initiator: p("x", a), recipient: p("y", b), tutorTeachesLinkedStudent: teaches });
          const staffA = a === "tutor" || a === "admin";
          const staffB = b === "tutor" || b === "admin";
          if (staffA === staffB) return expect(res.ok).toBe(false);
          const hasTutor = a === "tutor" || b === "tutor";
          if (!hasTutor) return expect(res.ok).toBe(true);
          if (a === "tutor" && b !== "parent") return expect(res.ok).toBe(false);
          expect(res.ok).toBe(teaches);
        });
      }
    }
  }
  it("blocks a minor on either side", () => {
    expect(canStartThread({ initiator: p("x", "student", true), recipient: p("y", "tutor"), tutorTeachesLinkedStudent: true }).ok).toBe(false);
    expect(canStartThread({ initiator: p("y", "tutor"), recipient: p("x", "student", true), tutorTeachesLinkedStudent: true }).ok).toBe(false);
    expect(canStartThread({ initiator: p("y", "admin"), recipient: p("x", "student", true), tutorTeachesLinkedStudent: true }).ok).toBe(false);
  });
  it("blocks self threads", () => {
    expect(canStartThread({ initiator: p("x", "parent"), recipient: p("x", "parent"), tutorTeachesLinkedStudent: true }).ok).toBe(false);
  });
  it("adult student may contact a tutor who teaches them", () => {
    expect(canStartThread({ initiator: p("s", "student"), recipient: p("t", "tutor"), tutorTeachesLinkedStudent: true }).ok).toBe(true);
    expect(canStartThread({ initiator: p("s", "student"), recipient: p("t", "tutor"), tutorTeachesLinkedStudent: false }).ok).toBe(false);
  });
});
