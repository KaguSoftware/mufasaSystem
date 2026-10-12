"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRunAction } from "@/components/catalog/use-run-action";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { reviewHomeworkSubmissionAction } from "@/server/actions/homework";

export type SubmissionView = {
  id: string;
  studentName: string;
  status: "submitted" | "reviewed" | "returned";
  text: string | null;
  attachmentUrl: string | null;
  recitationId: string | null;
  quizAttemptId: string | null;
  grade: number | null;
  feedback: string | null;
  submittedAt: string;
};

const TONE: Record<SubmissionView["status"], BadgeTone> = { submitted: "warning", reviewed: "success", returned: "danger" };

export function SubmissionReview({ submission: s }: { submission: SubmissionView }) {
  const t = useTranslations("homework");
  const run = useRunAction();
  const [grade, setGrade] = useState(s.grade === null ? "" : String(s.grade));
  const [feedback, setFeedback] = useState(s.feedback ?? "");
  const [busy, setBusy] = useState<"reviewed" | "returned" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(status: "reviewed" | "returned") {
    const g = grade.trim() === "" ? null : Number(grade);
    if (g !== null && (!Number.isInteger(g) || g < 0 || g > 100)) {
      setError(t("gradeRange"));
      return;
    }
    setError(null);
    setBusy(status);
    await run(() => reviewHomeworkSubmissionAction({ submissionId: s.id, grade: g, feedback: feedback.trim() || null, status }), {
      success: t("reviewSaved"),
    });
    setBusy(null);
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{s.studentName}</p>
          <p className="text-xs text-muted">{t("submittedAt", { date: s.submittedAt })}</p>
        </div>
        <Badge tone={TONE[s.status]}>{t(`submission_${s.status}`)}</Badge>
      </div>
      {s.text && <p className="whitespace-pre-line rounded-md bg-surface-2 p-3 text-sm">{s.text}</p>}
      {s.attachmentUrl && (
        <a href={s.attachmentUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
          {t("openAttachment")}
        </a>
      )}
      {s.recitationId && (
        <Link href="/tutor/reviews" className="text-sm text-primary hover:underline">
          {t("linkedRecitation")}
        </Link>
      )}
      {s.quizAttemptId && <p className="text-sm text-muted">{t("linkedQuiz")}</p>}
      {!s.text && !s.attachmentUrl && !s.recitationId && !s.quizAttemptId && <p className="text-sm text-muted">{t("autoSatisfied")}</p>}
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <Field label={t("grade")} hint={t("gradeHint")} error={error ?? undefined}>
          <Input inputMode="numeric" value={grade} maxLength={3} onChange={(e) => setGrade(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label={t("feedback")}>
          <Textarea rows={2} maxLength={2000} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button size="sm" loading={busy === "reviewed"} onClick={() => send("reviewed")}>
          {t("markReviewed")}
        </Button>
        <Button size="sm" variant="outline" loading={busy === "returned"} onClick={() => send("returned")}>
          {t("returnForRedo")}
        </Button>
      </div>
    </Card>
  );
}
