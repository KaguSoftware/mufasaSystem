/** Pure attendance math. No I/O. */

export type AttendanceStatus = "expected" | "present" | "late" | "absent" | "excused";

export type AttendanceRecord = { startsAt: Date; status: AttendanceStatus };

export type AttendanceStats = {
  present: number;
  late: number;
  absent: number;
  excused: number;
  /** Sessions still unmarked ("expected"). */
  pending: number;
  /** Sessions that count toward the rate: present + late + absent (excused and pending are ignored). */
  counted: number;
  /** Attended (present or late) divided by counted, 0..100 rounded, or null when nothing counted yet. */
  rate: number | null;
  /** Consecutive attended sessions ending at the most recent counted session. */
  currentStreak: number;
  longestStreak: number;
};

export const isAttended = (s: AttendanceStatus) => s === "present" || s === "late";

/**
 * Excused sessions are neutral: they neither break nor extend a streak and do
 * not lower the rate. Unmarked ("expected") sessions are ignored entirely.
 */
export function attendanceStats(records: AttendanceRecord[]): AttendanceStats {
  const counts = { present: 0, late: 0, absent: 0, excused: 0, pending: 0 };
  for (const r of records) {
    if (r.status === "expected") counts.pending++;
    else counts[r.status]++;
  }
  const counted = counts.present + counts.late + counts.absent;
  const rate = counted === 0 ? null : Math.round(((counts.present + counts.late) / counted) * 100);

  const ordered = records
    .filter((r) => r.status === "present" || r.status === "late" || r.status === "absent")
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  let run = 0;
  let longest = 0;
  for (const r of ordered) {
    run = isAttended(r.status) ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return { ...counts, counted, rate, currentStreak: run, longestStreak: longest };
}

/** A student joining more than `graceMin` minutes after the start counts as late. */
export function statusForJoin(startsAt: Date, joinedAt: Date, graceMin = 10): "present" | "late" {
  return joinedAt.getTime() - startsAt.getTime() > graceMin * 60_000 ? "late" : "present";
}
