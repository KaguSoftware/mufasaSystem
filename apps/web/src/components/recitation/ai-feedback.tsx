import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/misc";
import { displayWords, wordStatuses } from "@/lib/aligned-words";
import { alignWords } from "@/lib/word-diff";
import { RetryAiButton } from "./retry-ai-button";

export type AiFeedbackView = {
  recitationId: string;
  status: "queued" | "processing" | "done" | "failed";
  transcript: string | null;
  accuracy: number | null;
  tajweedNotes: { rule: string; word?: string; note: string; severity: "info" | "minor" | "major" }[] | null;
  summary: string | null;
  confidence: number | null;
  error: string | null;
};

const TONE = { info: "neutral", minor: "warning", major: "danger" } as const;

/** Expected ayah text with each word coloured by the deterministic diff against the transcript. */
export function AlignedAyahs({ uthmani, simple, transcript }: { uthmani: string; simple: string; transcript: string | null }) {
  const words = displayWords(uthmani);
  const count = words.filter((w) => w.index !== null).length;
  const statuses = transcript ? wordStatuses(alignWords(simple, transcript), count) : null;
  return (
    <p className="quran text-2xl leading-loose" dir="rtl">
      {words.map((w, i) => {
        const s = statuses && w.index !== null ? statuses[w.index] : "match";
        const cls = s === "missing" ? "rounded bg-danger-soft px-0.5" : s === "substitute" ? "rounded bg-warning-soft px-0.5" : "";
        return (
          <span key={i} className={cls}>
            {w.text}{" "}
          </span>
        );
      })}
    </p>
  );
}

/**
 * AI-assisted feedback panel. Always labelled as advisory: the tutor's grade is authoritative.
 * `expected` enables the highlighted word view (tutor review and student detail).
 */
export function AiFeedbackPanel({
  feedback,
  expected,
  canRetry,
}: {
  feedback: AiFeedbackView | null;
  expected?: { uthmani: string; simple: string } | null;
  canRetry?: boolean;
}) {
  const t = useTranslations("recitation");
  if (!feedback) return null;

  const accuracyPct = feedback.accuracy === null ? null : Math.round(feedback.accuracy * 100);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary-soft/30 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <p className="text-sm font-semibold">{t("aiTitle")}</p>
        <Badge tone="primary">{t("aiAdvisory")}</Badge>
      </div>

      {(feedback.status === "queued" || feedback.status === "processing") && (
        <p className="text-sm text-muted">{feedback.status === "queued" ? t("aiQueued") : t("aiProcessing")}</p>
      )}

      {feedback.status === "failed" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-danger">{t("aiFailed")}</p>
          {canRetry && <RetryAiButton recitationId={feedback.recitationId} />}
        </div>
      )}

      {feedback.status === "done" && (
        <>
          {accuracyPct !== null && (
            <div className="flex items-center gap-3">
              <div className="w-40">
                <Progress value={accuracyPct} />
              </div>
              <span className="text-sm tabular-nums">{t("aiAccuracy", { percent: accuracyPct })}</span>
              {feedback.confidence !== null && (
                <span className="text-xs text-muted">{t("aiConfidence", { percent: Math.round(feedback.confidence * 100) })}</span>
              )}
            </div>
          )}
          {feedback.summary && <p className="text-sm">{feedback.summary}</p>}
          {expected && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted">{t("aiWordView")}</p>
              <AlignedAyahs uthmani={expected.uthmani} simple={expected.simple} transcript={feedback.transcript} />
              <div className="mt-1 flex gap-3 text-xs text-muted">
                <span className="rounded bg-warning-soft px-1.5">{t("legendDifferent")}</span>
                <span className="rounded bg-danger-soft px-1.5">{t("legendMissing")}</span>
              </div>
            </div>
          )}
          {feedback.transcript && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted">{t("aiTranscript")}</p>
              <p className="quran text-lg" dir="rtl">
                {feedback.transcript}
              </p>
            </div>
          )}
          {feedback.tajweedNotes && feedback.tajweedNotes.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted">{t("aiTajweed")}</p>
              <ul className="flex flex-col gap-1.5">
                {feedback.tajweedNotes.map((n, i) => (
                  <li key={i} className="flex flex-wrap items-start gap-2 text-sm">
                    <Badge tone={TONE[n.severity]}>{t(`rule_${n.rule}` as "rule_other")}</Badge>
                    {n.word && (
                      <span className="quran" dir="rtl">
                        {n.word}
                      </span>
                    )}
                    <span>{n.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
