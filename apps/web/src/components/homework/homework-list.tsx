import { useFormatter, useLocale, useTranslations } from "next-intl";
import { t18n } from "@mufasa/config/locales";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import type { StudentHomeworkItem } from "@/server/dal/homework";
import { FreeHomeworkForm } from "@/app/[locale]/(panel)/student/_components/free-homework-form";

const TONE: Record<StudentHomeworkItem["state"], BadgeTone> = {
  open: "primary",
  overdue: "danger",
  submitted: "warning",
  reviewed: "success",
  returned: "danger",
};

/** Homework of one student. `interactive` shows the student's action buttons; otherwise read-only. */
export function HomeworkList({
  items,
  studentId,
  interactive,
}: {
  items: StudentHomeworkItem[];
  studentId: string;
  interactive: boolean;
}) {
  const t = useTranslations("homework");
  const format = useFormatter();
  const locale = useLocale();
  if (items.length === 0) return <EmptyState title={t("noHomework")} description={t("noHomeworkHint")} />;

  return (
    <div className="grid gap-4">
      {items.map(({ homework: hw, submission, state, lessonTitle, surahName }) => (
        <Card key={hw.id} className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{hw.title}</p>
              <p className="text-xs text-muted">
                {t(`target_${hw.targetType}`)} · {t("due", { date: format.dateTime(hw.dueAt, { dateStyle: "medium", timeStyle: "short" }) })}
              </p>
            </div>
            <Badge tone={TONE[state]}>{t(`state_${state}`)}</Badge>
          </div>
          {hw.instructions && <p className="whitespace-pre-line text-sm">{hw.instructions}</p>}
          {hw.targetType === "lesson" && lessonTitle != null && (
            <p className="text-sm text-muted">{t("lessonTarget", { title: t18n(lessonTitle as Parameters<typeof t18n>[0], locale) })}</p>
          )}
          {hw.targetType === "recitation" && surahName && hw.ayahFrom && hw.ayahTo && (
            <p className="text-sm text-muted">{t("recitationTarget", { surah: surahName, from: hw.ayahFrom, to: hw.ayahTo })}</p>
          )}
          {submission && (submission.grade !== null || submission.feedback) && (
            <div className="rounded-md bg-surface-2 p-3 text-sm">
              {submission.grade !== null && <p className="font-medium">{t("gradeLine", { grade: submission.grade })}</p>}
              {submission.feedback && <p className="mt-1 whitespace-pre-line">{submission.feedback}</p>}
            </div>
          )}
          {interactive && (!submission || submission.status === "returned") && (
            <div className="flex flex-wrap gap-2">
              {hw.targetType === "lesson" && hw.lessonId && (
                <Button asChild size="sm">
                  <Link href={`/student/learn/${hw.lessonId}`}>{t("openLesson")}</Link>
                </Button>
              )}
              {hw.targetType === "quiz" && hw.quizId && (
                <Button asChild size="sm">
                  <Link href={`/student/homework/quiz/${hw.quizId}`}>{t("takeQuiz")}</Link>
                </Button>
              )}
              {hw.targetType === "recitation" && (
                <Button asChild size="sm">
                  <Link href={`/student/recitations?homework=${hw.id}`}>{t("recordRecitation")}</Link>
                </Button>
              )}
              {hw.targetType === "free" && <FreeHomeworkForm homeworkId={hw.id} studentId={studentId} title={hw.title} />}
            </div>
          )}
          {interactive && hw.targetType === "lesson" && !submission && <p className="text-xs text-muted">{t("autoLessonHint")}</p>}
        </Card>
      ))}
    </div>
  );
}
