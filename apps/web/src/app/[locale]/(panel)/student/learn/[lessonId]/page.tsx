import { Lock } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { isDbConfigured } from "@mufasa/db";
import { t18n } from "@mufasa/config/locales";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import { AppError } from "@/server/errors";
import { getLessonForPlayer } from "@/server/dal/learn";
import { getQuizForLesson } from "@/server/dal/quiz";
import { requireUser } from "@/server/session";
import { LessonNav, LessonPlayer } from "../../_components/lesson-player";
import { LessonQuiz } from "../../_components/lesson-quiz";

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const t = await getTranslations("learn");
  if (!isDbConfigured()) return <PageHeader title={t("lesson")} />;

  const { lessonId } = await params;
  const user = await requireUser();
  const locale = await getLocale();

  let lesson;
  let quiz;
  try {
    lesson = await getLessonForPlayer(user, lessonId);
    quiz = await getQuizForLesson(user, lessonId);
  } catch (e) {
    if (e instanceof AppError && e.code === "not_found") notFound();
    if (e instanceof AppError && e.code === "no_access") {
      return (
        <EmptyState
          icon={<Lock className="size-8" />}
          title={t("lockedTitle")}
          description={user.isManagedChild ? t("lockedHintChild") : t("lockedHint")}
          action={
            <Button asChild>
              <Link href={user.isManagedChild ? "/parent/billing" : "/pricing"}>{t("unlock")}</Link>
            </Button>
          }
        />
      );
    }
    throw e;
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <PageHeader
        title={t18n(lesson.title, locale)}
        description={
          <>
            <Link href={`/student/courses/${lesson.courseSlug}`} className="text-primary hover:underline">
              {t18n(lesson.courseTitle, locale)}
            </Link>{" "}
            / {t18n(lesson.unitTitle, locale)}
          </>
        }
      />
      {lesson.summary && <p className="-mt-3 text-muted">{t18n(lesson.summary, locale)}</p>}
      <LessonPlayer lesson={lesson} />
      {quiz && <LessonQuiz quiz={quiz} />}
      <LessonNav prevId={lesson.prevLessonId} nextId={lesson.nextLessonId} />
    </div>
  );
}
