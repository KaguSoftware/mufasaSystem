import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { isDbConfigured } from "@mufasa/db";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { AppError } from "@/server/errors";
import { assertHomeworkQuizAccess } from "@/server/dal/homework";
import { getQuizForPlayer } from "@/server/dal/quiz";
import { requireUser } from "@/server/session";
import { HomeworkQuiz } from "../../../_components/homework-quiz";

export default async function HomeworkQuizPage({ params }: { params: Promise<{ quizId: string }> }) {
  const t = await getTranslations("homework");
  if (!isDbConfigured()) return <PageHeader title={t("title")} />;

  const { quizId } = await params;
  const user = await requireUser();
  let quiz;
  try {
    // Homework quizzes have no lesson, so the lesson access check does not cover them.
    await assertHomeworkQuizAccess(user, quizId);
    quiz = await getQuizForPlayer(user, quizId);
  } catch (e) {
    if (e instanceof AppError && e.code === "not_found") notFound();
    if (e instanceof AppError && e.code === "forbidden") return <EmptyState title={t("quizNotAssigned")} />;
    throw e;
  }
  return (
    <>
      <PageHeader title={t("homeworkQuiz")} />
      <HomeworkQuiz quiz={quiz} />
    </>
  );
}
