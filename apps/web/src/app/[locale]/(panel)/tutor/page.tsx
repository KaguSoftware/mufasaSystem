import { ClipboardList, Mic, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { isDbConfigured } from "@mufasa/db";
import { Announcements } from "@/components/announcements";
import { UpcomingSessions } from "@/components/live/upcoming-sessions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import { countHomeworkToReview } from "@/server/dal/homework";
import { countPendingReviews } from "@/server/dal/recitations";
import { tutorStudentIds } from "@/server/dal/tutoring";
import { requireRole } from "@/server/session";

export default async function TutorDashboardPage() {
  const t = await getTranslations("panel.tutor");
  if (!isDbConfigured()) return <PageHeader title={t("dashboard")} />;

  const user = await requireRole("tutor", "admin");
  const [pending, homework, students] = await Promise.all([
    countPendingReviews(user),
    countHomeworkToReview(user),
    user.role === "tutor" ? tutorStudentIds(user.id).then((ids) => ids.length) : Promise.resolve(0),
  ]);

  return (
    <>
      <PageHeader title={t("dashboard")} description={t("dashboardSubtitle")} />
      <div className="flex flex-col gap-6">
        <Announcements role="tutor" />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Stat label={t("pendingReviews")} value={pending} icon={<Mic className="size-4" />} hint={<Link href="/tutor/reviews" className="text-primary hover:underline">{t("openReviews")}</Link>} />
          <Stat label={t("homeworkToReview")} value={homework} icon={<ClipboardList className="size-4" />} hint={<Link href="/tutor/homework" className="text-primary hover:underline">{t("openHomework")}</Link>} />
          <Stat label={t("myStudents")} value={students} icon={<Users className="size-4" />} hint={<Link href="/tutor/students" className="text-primary hover:underline">{t("openStudents")}</Link>} />
        </div>

        <Card>
          <CardHeader
            title={t("upcomingSessions")}
            actions={
              <Button asChild variant="outline" size="sm">
                <Link href="/tutor/sessions">{t("allSessions")}</Link>
              </Button>
            }
          />
          <CardBody>
            <UpcomingSessions user={user} limit={5} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
