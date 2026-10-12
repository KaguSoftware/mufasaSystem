"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { t18n } from "@mufasa/config/locales";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { QuestionsForm } from "@/components/quiz/questions-form";
import { useRunAction } from "@/components/catalog/use-run-action";
import { Link } from "@/i18n/navigation";
import { enrollRecommendedAction, submitPlacementAction } from "@/server/actions/placement";
import type { PlacementResult } from "@/server/dal/placement";
import type { PlayerQuiz } from "@/server/dal/quiz";

export function PlacementFlow({
  quiz,
  studentId,
  studentName,
}: {
  quiz: PlayerQuiz;
  studentId: string;
  studentName: string | null;
}) {
  const t = useTranslations("placement");
  const tl = useTranslations("learn");
  const locale = useLocale();
  const run = useRunAction();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrolled, setEnrolled] = useState(false);

  async function submit(answers: Record<string, string[]>) {
    setSubmitting(true);
    const res = await run(() => submitPlacementAction({ studentId, answers }), { success: false, refresh: false });
    setSubmitting(false);
    if (res.ok) setResult(res.data);
  }

  async function enrollAll() {
    if (!result) return;
    setEnrolling(true);
    const res = await run(
      () => enrollRecommendedAction({ studentId, courseIds: result.recommendations.map((r) => r.courseId) }),
      { success: t("enrolledToast"), refresh: false },
    );
    setEnrolling(false);
    if (res.ok) setEnrolled(true);
  }

  if (result) {
    return (
      <div className="grid gap-6">
        <Card>
          <CardBody className="grid gap-2">
            <p className="text-lg font-semibold">
              {studentName ? t("resultTitleFor", { name: studentName }) : t("resultTitle")}
            </p>
            <p className="text-sm text-muted">{t("resultScore", { score: Math.round(result.score * 100) })}</p>
            {Object.keys(result.skillScores).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(result.skillScores).map(([skill, v]) => (
                  <Badge key={skill} tone="primary">
                    {t.has(`skill_${skill}` as never) ? t(`skill_${skill}` as never) : skill}: {Math.round(v * 100)}%
                  </Badge>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <div>
          <h2 className="mb-3 text-lg font-semibold">{t("recommended")}</h2>
          {result.recommendations.length === 0 ? (
            <p className="text-sm text-muted">{t("noRecommendation")}</p>
          ) : (
            <div className="grid gap-3">
              {result.recommendations.map((r) => (
                <Card key={r.courseId}>
                  <CardBody className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted">{t18n(r.programName, locale)}</p>
                      <p className="font-medium">{t18n(r.title, locale)}</p>
                    </div>
                    <Badge>{tl(`level_${r.level}`)}</Badge>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {result.recommendations.length > 0 && !enrolled && (
            <Button loading={enrolling} onClick={enrollAll}>
              {t("enrollRecommended")}
            </Button>
          )}
          <Button asChild variant={enrolled ? "primary" : "secondary"}>
            <Link href="/dashboard">{t("goToDashboard")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {studentName && <p className="text-sm text-muted">{t("takingFor", { name: studentName })}</p>}
      <QuestionsForm questions={quiz.questions} submitting={submitting} submitLabel={t("finish")} onSubmit={submit} />
    </div>
  );
}
