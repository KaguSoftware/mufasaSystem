import { getLocale, getTranslations } from "next-intl/server";
import { isDbConfigured } from "@mufasa/db";
import { t18n } from "@mufasa/config/locales";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, PageHeader, Progress } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import { availableCourses, myCourses } from "@/server/dal/learn";
import { requireUser } from "@/server/session";
import { EnrollButton } from "../_components/enroll-button";

export default async function StudentCoursesPage() {
  const t = await getTranslations("learn");
  if (!isDbConfigured()) return <PageHeader title={t("myCourses")} />;

  const user = await requireUser();
  const locale = await getLocale();
  const [mine, available] = await Promise.all([myCourses(user, user.id), availableCourses(user, user.id)]);

  return (
    <>
      <PageHeader title={t("myCourses")} />
      {mine.length === 0 ? (
        <EmptyState title={t("noCoursesYet")} description={t("noCoursesYetHint")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mine.map((c) => (
            <Card key={c.courseId}>
              <CardBody className="grid gap-3">
                <div>
                  <p className="text-xs text-muted">{t18n(c.programName, locale)}</p>
                  <Link href={`/student/courses/${c.slug}`} className="font-semibold hover:underline">
                    {t18n(c.title, locale)}
                  </Link>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={c.percent} />
                  <span className="text-sm tabular-nums text-muted">{c.percent}%</span>
                </div>
                <p className="text-xs text-muted">{t("lessonsProgress", { done: c.completedLessons, total: c.totalLessons })}</p>
                <div className="flex items-center justify-between">
                  {c.completedAt ? <Badge tone="success">{t("completed")}</Badge> : <span />}
                  {c.nextLessonId && (
                    <Button asChild size="sm" variant={c.completedAt ? "secondary" : "primary"}>
                      <Link href={`/student/learn/${c.nextLessonId}`}>
                        {c.completedAt ? t("review") : c.completedLessons > 0 ? t("continue") : t("start")}
                      </Link>
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-4 mt-10 text-lg font-semibold">{t("browseCourses")}</h2>
      {available.length === 0 ? (
        <p className="text-sm text-muted">{t("nothingToBrowse")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((c) => (
            <Card key={c.id}>
              <CardBody className="grid gap-3">
                <div>
                  <p className="text-xs text-muted">{t18n(c.programName, locale)}</p>
                  <Link href={`/student/courses/${c.slug}`} className="font-semibold hover:underline">
                    {t18n(c.title, locale)}
                  </Link>
                </div>
                {c.description && <p className="line-clamp-3 text-sm text-muted">{t18n(c.description, locale)}</p>}
                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5">
                    <Badge>{t(`level_${c.level}`)}</Badge>
                    {c.isFree && <Badge tone="success">{t("free")}</Badge>}
                  </div>
                  <EnrollButton courseId={c.id} studentId={user.id} slug={c.slug} variant="secondary" />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
