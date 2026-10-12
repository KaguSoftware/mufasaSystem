/**
 * Pure aggregation for the weekly parent digest. The service feeds rows that
 * are already scoped to one child; these helpers filter by window and count.
 */

export const DIGEST_DAYS = 7;

export type DigestWindow = { from: Date; to: Date };

export function digestWindow(now: Date, days = DIGEST_DAYS): DigestWindow {
  return { from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000), to: now };
}

export function inWindow(d: Date | null | undefined, w: DigestWindow): boolean {
  return Boolean(d) && d!.getTime() >= w.from.getTime() && d!.getTime() < w.to.getTime();
}

export type DigestRows = {
  /** lesson_progress.completedAt values. */
  lessonCompletions: (Date | null)[];
  xpEvents: { amount: number; createdAt: Date }[];
  streak: { current: number } | null;
  badges: { name: string; awardedAt: Date }[];
  hifzEntries: { status: string; ayahFrom: number; ayahTo: number; updatedAt: Date }[];
  recitations: { createdAt: Date; reviewedAt: Date | null; status: string }[];
  /** Homework targeted at the child with its due date and (if any) submission time. */
  homework: { dueAt: Date; submittedAt: Date | null }[];
  attendance: { status: string; startsAt: Date }[];
};

export type ChildDigest = {
  lessonsCompleted: number;
  xpGained: number;
  streak: number;
  badges: string[];
  ayahsMemorized: number;
  recitationsSubmitted: number;
  recitationsReviewed: number;
  homeworkDue: number;
  homeworkSubmitted: number;
  classesAttended: number;
  classesMissed: number;
};

export function summarizeChildWeek(rows: DigestRows, w: DigestWindow): ChildDigest {
  const memorized = rows.hifzEntries.filter((e) => e.status === "memorized" && inWindow(e.updatedAt, w));
  const due = rows.homework.filter((h) => inWindow(h.dueAt, w));
  const sessions = rows.attendance.filter((a) => inWindow(a.startsAt, w));
  return {
    lessonsCompleted: rows.lessonCompletions.filter((d) => inWindow(d, w)).length,
    xpGained: rows.xpEvents.filter((x) => inWindow(x.createdAt, w)).reduce((s, x) => s + Math.max(0, x.amount), 0),
    streak: rows.streak?.current ?? 0,
    badges: rows.badges.filter((b) => inWindow(b.awardedAt, w)).map((b) => b.name),
    ayahsMemorized: memorized.reduce((s, e) => s + Math.max(0, e.ayahTo - e.ayahFrom + 1), 0),
    recitationsSubmitted: rows.recitations.filter((r) => inWindow(r.createdAt, w)).length,
    recitationsReviewed: rows.recitations.filter((r) => r.status !== "pending" && inWindow(r.reviewedAt, w)).length,
    homeworkDue: due.length,
    homeworkSubmitted: due.filter((h) => h.submittedAt).length,
    classesAttended: sessions.filter((a) => a.status === "present" || a.status === "late").length,
    classesMissed: sessions.filter((a) => a.status === "absent").length,
  };
}

/** A digest is worth sending when the child did or missed something. A streak alone is not news. */
export function hasActivity(d: ChildDigest): boolean {
  return (
    d.lessonsCompleted +
      d.xpGained +
      d.badges.length +
      d.ayahsMemorized +
      d.recitationsSubmitted +
      d.recitationsReviewed +
      d.homeworkDue +
      d.classesAttended +
      d.classesMissed >
    0
  );
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!);
}
