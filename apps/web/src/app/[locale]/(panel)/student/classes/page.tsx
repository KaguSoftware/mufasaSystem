import { getLocale, getTranslations } from "next-intl/server";
import { Video } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { pageUser } from "@/components/account/page-user";
import { AttendanceSummary } from "@/components/live/attendance-summary";
import { fmtDateTime } from "@/components/live/format";
import { AttendanceBadge } from "@/components/live/status-badges";
import { UpcomingSessions } from "@/components/live/upcoming-sessions";
import { pastSessionsFor } from "@/server/dal/live";

export default async function StudentClassesPage() {
  const [t, locale, user] = await Promise.all([getTranslations("live"), getLocale(), pageUser()]);
  if (!user || user.role !== "student") return <PageHeader title={t("classesTitle")} />;
  const past = await pastSessionsFor(user, { limit: 30 });
  return (
    <>
      <PageHeader title={t("classesTitle")} description={t("classesSubtitle")} />
      <div className="flex flex-col gap-6">
        <UpcomingSessions user={user} limit={20} />
        <AttendanceSummary user={user} studentId={user.id} />
        <Card>
          <CardHeader title={t("pastTitle")} />
          {past.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<Video className="size-8" />} title={t("noPast")} />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {past.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.title}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {fmtDateTime(s.startsAt, user.timezone, locale)} · {s.tutorName}
                    </p>
                  </div>
                  {s.attendance && <AttendanceBadge status={s.attendance} />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
