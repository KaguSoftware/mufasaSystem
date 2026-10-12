import { describe, expect, it } from "vitest";
import { attendanceStats, statusForJoin, type AttendanceRecord } from "./attendance";

const d = (day: number) => new Date(Date.UTC(2026, 9, day, 10));
const rec = (day: number, status: AttendanceRecord["status"]): AttendanceRecord => ({ startsAt: d(day), status });

describe("attendanceStats", () => {
  it("returns a null rate with no counted sessions", () => {
    const s = attendanceStats([rec(1, "expected"), rec(2, "excused")]);
    expect(s.rate).toBeNull();
    expect(s.counted).toBe(0);
    expect(s.pending).toBe(1);
    expect(s.excused).toBe(1);
  });
  it("counts late as attended and ignores excused in the rate", () => {
    const s = attendanceStats([rec(1, "present"), rec(2, "late"), rec(3, "absent"), rec(4, "excused"), rec(5, "present")]);
    expect(s.counted).toBe(4);
    expect(s.rate).toBe(75);
  });
  it("computes current and longest streaks regardless of input order", () => {
    const s = attendanceStats([
      rec(6, "present"),
      rec(1, "present"),
      rec(2, "present"),
      rec(3, "present"),
      rec(4, "absent"),
      rec(5, "late"),
    ]);
    expect(s.longestStreak).toBe(3);
    expect(s.currentStreak).toBe(2);
  });
  it("excused does not break a streak", () => {
    const s = attendanceStats([rec(1, "present"), rec(2, "excused"), rec(3, "present")]);
    expect(s.currentStreak).toBe(2);
  });
  it("an absence at the end resets the current streak", () => {
    const s = attendanceStats([rec(1, "present"), rec(2, "present"), rec(3, "absent")]);
    expect(s.currentStreak).toBe(0);
    expect(s.longestStreak).toBe(2);
  });
});

describe("statusForJoin", () => {
  const start = new Date("2026-10-12T10:00:00Z");
  it("is present within the grace window", () => {
    expect(statusForJoin(start, new Date("2026-10-12T09:50:00Z"))).toBe("present");
    expect(statusForJoin(start, new Date("2026-10-12T10:10:00Z"))).toBe("present");
  });
  it("is late after the grace window", () => {
    expect(statusForJoin(start, new Date("2026-10-12T10:11:00Z"))).toBe("late");
  });
});
