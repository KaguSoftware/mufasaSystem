import { describe, expect, it } from "vitest";
import { digestWindow, escapeHtml, hasActivity, summarizeChildWeek, type DigestRows } from "./digest";

const now = new Date("2026-10-11T16:00:00Z");
const w = digestWindow(now);
const day = (n: number) => new Date(now.getTime() - n * 86_400_000);

const empty: DigestRows = {
  lessonCompletions: [],
  xpEvents: [],
  streak: null,
  badges: [],
  hifzEntries: [],
  recitations: [],
  homework: [],
  attendance: [],
};

describe("digest window", () => {
  it("covers the last 7 days", () => {
    expect(w.to).toEqual(now);
    expect(w.from).toEqual(day(7));
  });
});

describe("summarizeChildWeek", () => {
  it("returns zeros for an empty week and reports no activity", () => {
    const s = summarizeChildWeek(empty, w);
    expect(s).toMatchObject({ lessonsCompleted: 0, xpGained: 0, streak: 0, ayahsMemorized: 0, classesMissed: 0 });
    expect(hasActivity(s)).toBe(false);
  });

  it("counts only rows inside the window", () => {
    const s = summarizeChildWeek(
      {
        ...empty,
        lessonCompletions: [day(1), day(6), day(8), null],
        xpEvents: [
          { amount: 10, createdAt: day(2) },
          { amount: 20, createdAt: day(3) },
          { amount: 99, createdAt: day(10) },
          { amount: -5, createdAt: day(1) },
        ],
        streak: { current: 4 },
        badges: [
          { name: "First lesson", awardedAt: day(2) },
          { name: "Old badge", awardedAt: day(30) },
        ],
        hifzEntries: [
          { status: "memorized", ayahFrom: 1, ayahTo: 7, updatedAt: day(1) },
          { status: "learning", ayahFrom: 8, ayahTo: 12, updatedAt: day(1) },
          { status: "memorized", ayahFrom: 1, ayahTo: 3, updatedAt: day(20) },
        ],
        recitations: [
          { createdAt: day(2), reviewedAt: day(1), status: "reviewed" },
          { createdAt: day(3), reviewedAt: null, status: "pending" },
          { createdAt: day(20), reviewedAt: day(19), status: "reviewed" },
        ],
        homework: [
          { dueAt: day(2), submittedAt: day(3) },
          { dueAt: day(1), submittedAt: null },
          { dueAt: day(14), submittedAt: day(15) },
        ],
        attendance: [
          { status: "present", startsAt: day(1) },
          { status: "late", startsAt: day(2) },
          { status: "absent", startsAt: day(3) },
          { status: "excused", startsAt: day(4) },
          { status: "absent", startsAt: day(40) },
        ],
      },
      w,
    );
    expect(s).toEqual({
      lessonsCompleted: 2,
      xpGained: 30,
      streak: 4,
      badges: ["First lesson"],
      ayahsMemorized: 7,
      recitationsSubmitted: 2,
      recitationsReviewed: 1,
      homeworkDue: 2,
      homeworkSubmitted: 1,
      classesAttended: 2,
      classesMissed: 1,
    });
    expect(hasActivity(s)).toBe(true);
  });

  it("a streak alone is not activity", () => {
    expect(hasActivity(summarizeChildWeek({ ...empty, streak: { current: 9 } }, w))).toBe(false);
  });
});

describe("escapeHtml", () => {
  it("escapes markup", () => {
    expect(escapeHtml("<b>\"A&B\"</b>")).toBe("&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;");
  });
});
