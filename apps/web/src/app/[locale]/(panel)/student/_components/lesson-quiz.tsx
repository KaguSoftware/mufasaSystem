"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { QuestionsForm } from "@/components/quiz/questions-form";
import { useRunAction } from "@/components/catalog/use-run-action";
import { t18n } from "@mufasa/config/locales";
import { useLocale } from "next-intl";
import { submitQuizAction } from "@/server/actions/quiz";
import type { PlayerQuiz, QuizSubmission } from "@/server/dal/quiz";

export function LessonQuiz({ quiz }: { quiz: PlayerQuiz }) {
  const t = useTranslations("quiz");
  const locale = useLocale();
  const run = useRunAction();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizSubmission | null>(null);
  const [attempt, setAttempt] = useState(0);

  if (quiz.questions.length === 0) return null;

  async function submit(answers: Record<string, string[]>) {
    setSubmitting(true);
    const res = await run(() => submitQuizAction({ quizId: quiz.id, answers }), { success: false });
    setSubmitting(false);
    if (res.ok) {
      setResult(res.data);
      if (res.data.passed) toast.success(res.data.xpAwarded ? t("passedToastXp") : t("passedToast"));
    }
  }

  return (
    <Card>
      <CardHeader
        title={t18n(quiz.title, locale)}
        description={t("passMark", { score: Math.round(quiz.passScore * 100) })}
        actions={
          quiz.lastAttempt && !result ? (
            <Badge tone={quiz.lastAttempt.passed ? "success" : "warning"}>
              {t("lastScore", { score: Math.round(quiz.lastAttempt.score * 100) })}
            </Badge>
          ) : null
        }
      />
      <CardBody className="grid gap-4">
        {result && (
          <div className={`rounded-md p-4 ${result.passed ? "bg-success-soft" : "bg-warning-soft"}`}>
            <p className="font-medium">{result.passed ? t("passed") : t("failed")}</p>
            <p className="text-sm text-muted">{t("yourScore", { score: Math.round(result.score * 100) })}</p>
            {!result.passed && (
              <Button
                className="mt-3"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setResult(null);
                  setAttempt((a) => a + 1);
                }}
              >
                {t("tryAgain")}
              </Button>
            )}
          </div>
        )}
        <QuestionsForm
          key={attempt}
          questions={quiz.questions}
          submitting={submitting}
          results={result?.perQuestion}
          explanations={result?.explanations}
          onSubmit={submit}
        />
      </CardBody>
    </Card>
  );
}
