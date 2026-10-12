"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRunAction } from "@/components/catalog/use-run-action";
import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/controls";
import { Field, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { reviewRecitationAction } from "@/server/actions/recitations";

export function ReviewForm({ recitationId, hasHifzEntry }: { recitationId: string; hasHifzEntry: boolean }) {
  const t = useTranslations("recitation");
  const run = useRunAction();
  const [score, setScore] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [status, setStatus] = useState<"reviewed" | "needs_redo">("reviewed");
  const [hifzStatus, setHifzStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!score) {
      setError(t("scoreRequired"));
      return;
    }
    setError(null);
    setBusy(true);
    await run(
      () =>
        reviewRecitationAction({
          recitationId,
          score: Number(score),
          feedback: feedback.trim() || null,
          status,
          hifzStatus: hasHifzEntry ? (hifzStatus as "learning" | "memorized" | "needs_review" | null) : null,
        }),
      { success: t("reviewSaved") },
    );
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("score")} hint={t("scoreHint")} error={error ?? undefined} required>
          <Select
            placeholder={t("selectScore")}
            value={score}
            onChange={setScore}
            options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: t(`score_${n}` as "score_1") }))}
          />
        </Field>
        {hasHifzEntry && (
          <Field label={t("updateHifz")} hint={t("updateHifzHint")}>
            <Select
              clearable
              placeholder={t("noChange")}
              value={hifzStatus}
              onChange={setHifzStatus}
              options={[
                { value: "learning", label: t("hifz_learning") },
                { value: "memorized", label: t("hifz_memorized") },
                { value: "needs_review", label: t("hifz_needs_review") },
              ]}
            />
          </Field>
        )}
      </div>
      <Field label={t("feedback")}>
        <Textarea rows={3} maxLength={2000} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      </Field>
      <RadioGroup
        value={status}
        onValueChange={(v) => setStatus(v as typeof status)}
        className="grid gap-2 sm:grid-cols-2"
        options={[
          { value: "reviewed", label: t("outcome_reviewed"), description: t("outcome_reviewed_hint") },
          { value: "needs_redo", label: t("outcome_needs_redo"), description: t("outcome_needs_redo_hint") },
        ]}
      />
      <Button type="submit" loading={busy} className="self-start">
        {t("submitReview")}
      </Button>
    </form>
  );
}
