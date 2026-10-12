import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  calendarDate,
  computeSlots,
  expandWeekly,
  mergeIntervals,
  slotsCover,
  subtractIntervals,
  tzOffsetMs,
  validateWeekly,
  zonedTimeToUtc,
  type WeeklyRange,
} from "./slots";

const iv = (a: string, b: string) => ({ start: new Date(a), end: new Date(b) });
const iso = (d: Date) => d.toISOString();

describe("zonedTimeToUtc", () => {
  it("converts a fixed offset zone (Istanbul is UTC+3)", () => {
    expect(iso(zonedTimeToUtc(2026, 10, 12, 18, 0, "Europe/Istanbul")!)).toBe("2026-10-12T15:00:00.000Z");
  });
  it("handles zones with a half hour offset", () => {
    expect(iso(zonedTimeToUtc(2026, 10, 12, 9, 30, "Asia/Kolkata")!)).toBe("2026-10-12T04:00:00.000Z");
  });
  it("uses summer and winter offsets in New York", () => {
    expect(iso(zonedTimeToUtc(2026, 7, 1, 9, 0, "America/New_York")!)).toBe("2026-07-01T13:00:00.000Z");
    expect(iso(zonedTimeToUtc(2026, 1, 15, 9, 0, "America/New_York")!)).toBe("2026-01-15T14:00:00.000Z");
  });
  it("returns null for a time inside the spring-forward gap", () => {
    expect(zonedTimeToUtc(2026, 3, 8, 2, 30, "America/New_York")).toBeNull();
    expect(iso(zonedTimeToUtc(2026, 3, 8, 3, 30, "America/New_York")!)).toBe("2026-03-08T07:30:00.000Z");
  });
  it("picks the earlier instant for an ambiguous fall-back time", () => {
    expect(iso(zonedTimeToUtc(2026, 11, 1, 1, 30, "America/New_York")!)).toBe("2026-11-01T05:30:00.000Z");
  });
  it("tzOffsetMs reflects DST", () => {
    expect(tzOffsetMs(new Date("2026-07-01T12:00:00Z"), "Europe/Berlin")).toBe(2 * 3600_000);
    expect(tzOffsetMs(new Date("2026-01-01T12:00:00Z"), "Europe/Berlin")).toBe(3600_000);
  });
});

describe("calendar helpers", () => {
  it("adds days across month and year ends", () => {
    expect(addCalendarDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addCalendarDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("finds the local date of an instant", () => {
    expect(calendarDate(new Date("2026-10-12T22:30:00Z"), "Europe/Istanbul")).toBe("2026-10-13");
  });
});

describe("validateWeekly", () => {
  it("accepts sane ranges and rejects bad ones", () => {
    expect(validateWeekly([{ day: 1, start: "09:00", end: "12:00" }, { day: 1, start: "14:00", end: "16:00" }])).toBe(true);
    expect(validateWeekly([{ day: 1, start: "12:00", end: "09:00" }])).toBe(false);
    expect(validateWeekly([{ day: 1, start: "09:00", end: "12:00" }, { day: 1, start: "11:00", end: "13:00" }])).toBe(false);
    expect(validateWeekly([{ day: 1, start: "9:00", end: "12:00" }])).toBe(false);
  });
});

describe("interval math", () => {
  it("merges overlapping and touching intervals", () => {
    const m = mergeIntervals([
      iv("2026-01-01T10:00Z", "2026-01-01T11:00Z"),
      iv("2026-01-01T11:00Z", "2026-01-01T12:00Z"),
      iv("2026-01-01T13:00Z", "2026-01-01T14:00Z"),
    ]);
    expect(m).toHaveLength(2);
    expect(iso(m[0]!.end)).toBe("2026-01-01T12:00:00.000Z");
  });
  it("subtracts a middle cut into two pieces", () => {
    const r = subtractIntervals(
      [iv("2026-01-01T10:00Z", "2026-01-01T14:00Z")],
      [iv("2026-01-01T11:00Z", "2026-01-01T12:00Z")],
    );
    expect(r.map((x) => [iso(x.start), iso(x.end)])).toEqual([
      ["2026-01-01T10:00:00.000Z", "2026-01-01T11:00:00.000Z"],
      ["2026-01-01T12:00:00.000Z", "2026-01-01T14:00:00.000Z"],
    ]);
  });
  it("removes everything when fully covered", () => {
    expect(
      subtractIntervals([iv("2026-01-01T10:00Z", "2026-01-01T11:00Z")], [iv("2026-01-01T09:00Z", "2026-01-01T12:00Z")]),
    ).toEqual([]);
  });
});

describe("expandWeekly", () => {
  // 2026-10-12 is a Monday
  const av: WeeklyRange[] = [{ day: 1, start: "16:00", end: "18:00" }];
  it("places the template on the right weekday in the tutor timezone", () => {
    const r = expandWeekly(av, "Europe/Istanbul", "2026-10-12", 7);
    expect(r).toHaveLength(1);
    expect(iso(r[0]!.start)).toBe("2026-10-12T13:00:00.000Z");
    expect(iso(r[0]!.end)).toBe("2026-10-12T15:00:00.000Z");
  });
  it("repeats weekly", () => {
    expect(expandWeekly(av, "Europe/Istanbul", "2026-10-12", 15)).toHaveLength(3);
  });
  it("keeps local wall time across a DST change (America/New_York, Sunday 2026-11-01)", () => {
    const sunday: WeeklyRange[] = [{ day: 0, start: "10:00", end: "11:00" }];
    const r = expandWeekly(sunday, "America/New_York", "2026-10-25", 14);
    expect(r.map((x) => iso(x.start))).toEqual(["2026-10-25T14:00:00.000Z", "2026-11-01T15:00:00.000Z"]);
  });
  it("skips ranges whose start falls in the spring-forward gap", () => {
    const sunday: WeeklyRange[] = [{ day: 0, start: "02:30", end: "03:30" }];
    expect(expandWeekly(sunday, "America/New_York", "2026-03-08", 1)).toEqual([]);
  });
});

describe("computeSlots", () => {
  const base = {
    availability: [{ day: 1, start: "16:00", end: "18:00" }] as WeeklyRange[],
    timeZone: "Europe/Istanbul",
    fromDate: "2026-10-12",
    days: 7,
    now: new Date("2026-10-10T00:00:00Z"),
  };
  it("splits availability into 30 minute slots", () => {
    const s = computeSlots(base);
    expect(s).toHaveLength(4);
    expect(iso(s[0]!.startsAt)).toBe("2026-10-12T13:00:00.000Z");
    expect(iso(s[3]!.endsAt)).toBe("2026-10-12T15:00:00.000Z");
  });
  it("removes unavailable exceptions and busy sessions", () => {
    const s = computeSlots({
      ...base,
      unavailable: [iv("2026-10-12T13:00:00Z", "2026-10-12T13:30:00Z")],
      busy: [iv("2026-10-12T14:00:00Z", "2026-10-12T14:45:00Z")],
    });
    expect(s.map((x) => iso(x.startsAt))).toEqual(["2026-10-12T13:30:00.000Z"]);
  });
  it("adds extra availability", () => {
    const s = computeSlots({ ...base, extra: [iv("2026-10-14T09:00:00Z", "2026-10-14T10:00:00Z")] });
    expect(s).toHaveLength(6);
  });
  it("hides slots inside the minimum lead time", () => {
    const s = computeSlots({ ...base, now: new Date("2026-10-12T12:30:00Z"), minLeadMin: 60 });
    expect(s.map((x) => iso(x.startsAt))).toEqual([
      "2026-10-12T13:30:00.000Z",
      "2026-10-12T14:00:00.000Z",
      "2026-10-12T14:30:00.000Z",
    ]);
  });
  it("returns nothing for an empty week", () => {
    expect(computeSlots({ ...base, availability: [] })).toEqual([]);
  });
  it("aligns odd ranges to the half hour clock", () => {
    const s = computeSlots({ ...base, availability: [{ day: 1, start: "16:10", end: "17:40" }] });
    expect(s.map((x) => iso(x.startsAt))).toEqual(["2026-10-12T13:30:00.000Z", "2026-10-12T14:00:00.000Z"]);
  });
});

describe("slotsCover", () => {
  it("requires every 30 minute piece of the duration to be free", () => {
    const s = computeSlots({
      availability: [{ day: 1, start: "16:00", end: "17:00" }],
      timeZone: "Europe/Istanbul",
      fromDate: "2026-10-12",
      days: 1,
      now: new Date("2026-10-01T00:00:00Z"),
    });
    expect(slotsCover(s, new Date("2026-10-12T13:00:00Z"), 60)).toBe(true);
    expect(slotsCover(s, new Date("2026-10-12T13:30:00Z"), 60)).toBe(false);
    expect(slotsCover(s, new Date("2026-10-12T13:00:00Z"), 45)).toBe(false);
  });
});
