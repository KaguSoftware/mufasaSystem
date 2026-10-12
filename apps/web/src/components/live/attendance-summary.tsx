import { getTranslations } from "next-intl/server";
import { Card, CardHeader, Stat } from "@/components/ui/card";
import { attendanceFor } from "@/server/dal/live";
import type { SessionUser } from "@/server/session";

/**
 * Reusable server component: attendance rate, counts and streak for one student.
 * Access is enforced by the DAL (self, parent, assigned tutor, admin).
 * Wire it into the parent progress page: <AttendanceSummary user={user} studentId={childId} />
 */
export async function AttendanceSummary({ user, studentId }: { user: SessionUser; studentId: string }) {
  const [t, stats] = await Promise.all([getTranslations("live"), attendanceFor(user, studentId).catch(() => null)]);
  if (!stats) return null;
  return (
    <Card>
      <CardHeader title={t("attendanceTitle")} description={t("attendanceHint")} />
      {stats.counted === 0 && stats.excused === 0 ? (
        <p className="p-5 text-sm text-muted">{t("attendanceNone")}</p>
      ) : (
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t("attendanceRate")} value={stats.rate === null ? "-" : `${stats.rate}%`} />
          <Stat label={t("attendanceAttended")} value={`${stats.present + stats.late}/${stats.counted}`} hint={t("attendanceLateCount", { n: stats.late })} />
          <Stat label={t("attendanceStreak")} value={stats.currentStreak} hint={t("attendanceBest", { n: stats.longestStreak })} />
          <Stat label={t("attendanceMissed")} value={stats.absent} hint={t("attendanceExcusedCount", { n: stats.excused })} />
        </div>
      )}
    </Card>
  );
}
