import { CheckCircle2, FileText, HelpCircle, Lock, Mic, PlayCircle, Video } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { isDbConfigured } from "@mufasa/db";
import { t18n } from "@mufasa/config/locales";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader, Progress } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import { AppError } from "@/server/errors";
import { getStudentCourseView } from "@/server/dal/learn";
import { requireUser } from "@/server/session";
import { EnrollButton } from "../../_components/enroll-button";

const TYPE_ICON = { video: PlayCircle, reading: FileText, quiz: HelpCircle, recitation: Mic, live: Video } as const;

export default async function StudentCoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getTranslations("learn");
  if (!isDbConfigured()) return <PageHeader title={t("myCourses")} />;

  const { slug } = await params;
  const user = await requireUser();
  const locale = await getLocale();
  let view;
  try {
    view = await getStudentCourseView(user, user.id, slug);
  } catch (e) {
    if (e instanceof AppError && e.code === "not_found") notFound();
    throw e;
  }
  const { course, enrolled, hasAccess, completedLessonIds, percent } = view;
  const done = new Set(completedLessonIds);
  // Managed children cannot pay themselves: send them to the parent's billing page.
  const unlockHref = user.isManagedChild ? "/parent/billing" : "/pricing";

  return (
    <>
      <PageHeader
        title={t18n(course.title, locale)}
        description={t18n(course.program.name, locale)}
        actions={!enrolled ? <EnrollButton courseId={course.id} studentId={user.id} slug={course.slug} /> : undefined}
      />

      {course.description && <p className="mb-6 max-w-3xl text-muted">{t18n(course.description, locale)}</p>}

      {enrolled && (
        <div className="mb-6 flex max-w-md items-center gap-3">
          <Progress value={percent} />
          <span className="text-sm tabular-nums text-muted">{percent}%</span>
        </div>
      )}

      {!hasAccess && (
        <Card className="mb-6 border-warning/40 bg-warning-soft">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 size-5 text-warning" />
              <div>
                <p className="font-medium">{t("lockedTitle")}</p>
                <p className="text-sm text-muted">{user.isManagedChild ? t("lockedHintChild") : t("lockedHint")}</p>
              </div>
            </div>
            <Button asChild>
              <Link href={unlockHref}>{t("unlock")}</Link>
            </Button>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-4">
        {course.units.map((unit) => (
          <Card key={unit.id}>
            <CardHeader title={t18n(unit.title, locale)} />
            <div className="divide-y divide-border">
              {unit.lessons.map((lesson) => {
                const open = hasAccess || lesson.isPreview;
                const Icon = TYPE_ICON[lesson.type];
                const row = (
                  <div className="flex items-center gap-3 px-5 py-3">
                    {done.has(lesson.id) ? (
                      <CheckCircle2 className="size-5 text-success" />
                    ) : open ? (
                      <Icon className="size-5 text-primary" />
                    ) : (
                      <Lock className="size-5 text-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={open ? "font-medium" : "text-muted"}>{t18n(lesson.title, locale)}</p>
                      {lesson.summary && <p className="truncate text-xs text-muted">{t18n(lesson.summary, locale)}</p>}
                    </div>
                    {lesson.isPreview && !hasAccess && <Badge tone="success">{t("freePreview")}</Badge>}
                    {!lesson.published && <Badge tone="warning">{t("draft")}</Badge>}
                    {lesson.videoDurationSec ? (
                      <span className="text-xs tabular-nums text-muted">{t("minutes", { count: Math.max(1, Math.round(lesson.videoDurationSec / 60)) })}</span>
                    ) : null}
                  </div>
                );
                return open ? (
                  <Link key={lesson.id} href={`/student/learn/${lesson.id}`} className="block transition-colors hover:bg-surface-2">
                    {row}
                  </Link>
                ) : (
                  <div key={lesson.id} aria-disabled>{row}</div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
