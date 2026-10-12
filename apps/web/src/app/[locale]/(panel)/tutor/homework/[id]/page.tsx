import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { isDbConfigured } from "@mufasa/db";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { AppError } from "@/server/errors";
import { listHomeworkSubmissions, listTutorHomework } from "@/server/dal/homework";
import { requireRole } from "@/server/session";
import { SubmissionReview } from "../../_components/submission-review";
import { DeleteHomeworkButton } from "../../_components/delete-homework-button";

export default async function TutorHomeworkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("homework");
  if (!isDbConfigured()) return <PageHeader title={t("title")} />;

  const { id } = await params;
  const user = await requireRole("tutor", "admin");
  const format = await getFormatter();
  let subs;
  try {
    subs = await listHomeworkSubmissions(user, id);
  } catch (e) {
    if (e instanceof AppError && (e.code === "not_found" || e.code === "forbidden")) notFound();
    throw e;
  }
  const hw = (await listTutorHomework(user)).find((h) => h.id === id);
  if (!hw) notFound();

  return (
    <>
      <PageHeader
        title={hw.title}
        description={`${t(`target_${hw.targetType}`)} · ${t("due", { date: format.dateTime(hw.dueAt, { dateStyle: "medium", timeStyle: "short" }) })} · ${t("submittedOf", { submitted: hw.submitted, total: hw.recipients })}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/tutor/homework">{t("backToList")}</Link>
            </Button>
            <DeleteHomeworkButton homeworkId={hw.id} />
          </>
        }
      />
      {hw.instructions && <p className="mb-6 whitespace-pre-line text-sm text-muted">{hw.instructions}</p>}
      {subs.length === 0 ? (
        <EmptyState title={t("noSubmissions")} />
      ) : (
        <div className="grid gap-4">
          {subs.map((s) => (
            <SubmissionReview
              key={s.id}
              submission={{
                id: s.id,
                studentName: s.studentName,
                status: s.status,
                text: s.text,
                attachmentUrl: s.attachmentUrl,
                recitationId: s.recitationId,
                quizAttemptId: s.quizAttemptId,
                grade: s.grade,
                feedback: s.feedback,
                submittedAt: format.dateTime(s.submittedAt, { dateStyle: "medium", timeStyle: "short" }),
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
