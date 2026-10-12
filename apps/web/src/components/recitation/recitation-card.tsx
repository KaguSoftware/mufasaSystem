import { useTranslations } from "next-intl";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { RecitationListItem } from "@/server/dal/recitations";
import { AiFeedbackPanel } from "./ai-feedback";

const TONE: Record<RecitationListItem["status"], BadgeTone> = { pending: "warning", reviewed: "success", needs_redo: "danger" };

/** One recitation: audio, status, tutor feedback (authoritative) and the AI-assisted panel. */
export function RecitationCard({
  item,
  expected,
  canRetryAi,
  dateLabel,
}: {
  item: RecitationListItem;
  expected?: { uthmani: string; simple: string } | null;
  canRetryAi?: boolean;
  dateLabel: string;
}) {
  const t = useTranslations("recitation");
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">
            {item.surahName} <span className="quran text-base text-muted">{item.surahNameAr}</span>
          </p>
          <p className="text-xs text-muted">
            {t("ayahRange", { from: item.ayahFrom, to: item.ayahTo })} · {dateLabel}
          </p>
        </div>
        <Badge tone={TONE[item.status]}>{t(`status_${item.status}`)}</Badge>
      </div>
      {item.audioUrl && <audio controls preload="none" src={item.audioUrl} className="w-full" />}
      {item.status !== "pending" && (
        <div className="rounded-md bg-surface-2 p-3 text-sm">
          {item.tutorScore !== null && <p className="font-medium">{t("tutorScore", { score: item.tutorScore })}</p>}
          {item.tutorFeedback && <p className="mt-1 whitespace-pre-line">{item.tutorFeedback}</p>}
        </div>
      )}
      <AiFeedbackPanel feedback={item.ai} expected={expected} canRetry={canRetryAi} />
    </Card>
  );
}
