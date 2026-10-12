import { getLocale, getTranslations } from "next-intl/server";
import { CalendarDays, Video } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { windowState } from "@/lib/live-window";
import { upcomingSessionsFor } from "@/server/dal/live";
import type { SessionUser } from "@/server/session";
import { fmtDateTime } from "./format";
import { AttendanceBadge } from "./status-badges";

/**
 * Reusable server component: upcoming live classes for the viewer.
 * - student: own classes with a Join button inside the join window
 * - parent: all children's classes (or one child via `studentId`), no join button
 * - tutor: own sessions with a Start button
 * Wire it into dashboards: <UpcomingSessions user={user} limit={5} />
 */
export async function UpcomingSessions({
  user,
  studentId,
  limit = 5,
  title,
  hideEmpty = false,
}: {
  user: SessionUser;
  studentId?: string;
  limit?: number;
  title?: string;
  hideEmpty?: boolean;
}) {
  const [t, locale, rows] = await Promise.all([
    getTranslations("live"),
    getLocale(),
    upcomingSessionsFor(user, { studentId, limit }).catch(() => []),
  ]);
  if (!rows.length && hideEmpty) return null;
  const now = new Date();
  return (
    <Card>
      <CardHeader title={title ?? t("upcomingTitle")} />
      {rows.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={<CalendarDays className="size-8" />} title={t("noUpcoming")} description={t("noUpcomingHint")} />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((s) => {
            const open = windowState(s.startsAt, s.durationMin, now) === "open";
            const canJoin = open && (user.role === "student" || user.role === "tutor");
            return (
              <li key={`${s.id}:${s.studentId ?? ""}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.title}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {fmtDateTime(s.startsAt, user.timezone, locale)} · {t("minutes", { n: s.durationMin })}
                    {user.role === "parent" && s.studentName ? ` · ${s.studentName}` : ""}
                    {user.role !== "tutor" && s.tutorName ? ` · ${s.tutorName}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {s.status === "live" && <Badge tone="success">{t("sessionStatus.live")}</Badge>}
                  {s.attendance && s.attendance !== "expected" && <AttendanceBadge status={s.attendance} />}
                  {canJoin && (
                    <Button asChild size="sm">
                      <Link href={`/live/${s.id}`}>
                        <Video className="size-4" />
                        {user.role === "tutor" ? t("start") : t("join")}
                      </Link>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
