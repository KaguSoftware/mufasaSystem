import { getTranslations } from "next-intl/server";
import { isDbConfigured } from "@mufasa/db";
import { Stat } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { adminOverviewCounts } from "@/server/dal/catalog";
import { requireRole } from "@/server/session";

export default async function AdminHome() {
  const t = await getTranslations("panel.admin");
  const tc = await getTranslations("catalog");
  if (!isDbConfigured()) return <PageHeader title={t("dashboard")} />;

  const user = await requireRole("admin");
  const counts = await adminOverviewCounts(user);

  return (
    <>
      <PageHeader title={t("dashboard")} description={tc("overviewDescription")} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={tc("statStudents")} value={counts.students} />
        <Stat label={tc("statPrograms")} value={counts.programs} />
        <Stat label={tc("statCourses")} value={counts.courses} />
        <Stat label={tc("statLessons")} value={counts.lessons} />
        {/* billing stats slot: the billing module adds revenue / active subscriptions / pending receipts here */}
      </div>
    </>
  );
}
