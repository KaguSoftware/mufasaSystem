import { Flame, Star } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { isDbConfigured } from "@mufasa/db";
import { t18n } from "@mufasa/config/locales";
import { Announcements } from "@/components/announcements";
import { BadgeIcon } from "@/components/gamification/badge-icon";
import { UpcomingSessions } from "@/components/live/upcoming-sessions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { EmptyState, PageHeader, Progress } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import { studentDashboard } from "@/server/dal/learn";
import { requireUser } from "@/server/session";

export default async function StudentDashboard() {
  const t = await getTranslations("learn");
  const tg = await getTranslations("gamification");
  const tp = await getTranslations("panel.student");
  if (!isDbConfigured()) return <PageHeader title={tp("dashboard")} />;

  const user = await requireUser();
  const locale = await getLocale();
  const data = await studentDashboard(user, user.id);
  const cont = data.continueCourse;

  return (
    <>
      <PageHeader title={t("welcome", { name: user.name.split(" ")[0] ?? user.name })} description={t("dashboardSubtitle")} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={tg("currentStreak")} value={tg("days", { count: data.streak.current })} icon={<Flame className="size-4 text-warning" />} />
        <Stat label={tg("totalXp")} value={data.totalXp} icon={<Star className="size-4 text-warning" />} />
        <Stat label={t("coursesInProgress")} value={data.courses.filter((c) => !c.completedAt).length} />
      </div>

      <div className="mb-6 flex flex-col gap-6">
        <Announcements role="student" />
        <UpcomingSessions user={user} limit={3} hideEmpty />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t("continueLearning")} />
          <CardBody>
            {cont ? (
              <div className="grid gap-4">
                <div>
                  <p className="text-sm text-muted">{t18n(cont.programName, locale)}</p>
                  <p className="text-lg font-semibold">{t18n(cont.title, locale)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={cont.percent} />
                  <span className="text-sm tabular-nums text-muted">{cont.percent}%</span>
                </div>
                <div>
                  <Button asChild>
                    <Link href={`/student/learn/${cont.nextLessonId}`}>{cont.completedLessons > 0 ? t("continue") : t("start")}</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState
                title={t("nothingInProgress")}
                description={t("nothingInProgressHint")}
                action={
                  <Button asChild>
                    <Link href="/student/courses">{t("browseCourses")}</Link>
                  </Button>
                }
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={tg("recentBadges")}
            actions={
              <Button asChild variant="link" size="sm">
                <Link href="/student/achievements">{tg("viewAll")}</Link>
              </Button>
            }
          />
          <CardBody>
            {data.recentBadges.length === 0 ? (
              <p className="text-sm text-muted">{tg("noBadgesYet")}</p>
            ) : (
              <ul className="grid gap-3">
                {data.recentBadges.map((b) => (
                  <li key={b.id} className="flex items-center gap-3">
                    <BadgeIcon name={b.icon} earned className="size-10 [&_svg]:size-5" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t18n(b.name, locale)}</p>
                      <p className="truncate text-xs text-muted">{t18n(b.description, locale)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
