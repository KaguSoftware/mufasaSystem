import { getFormatter, getTranslations } from "next-intl/server";
import { isDbConfigured } from "@mufasa/db";
import { AiFeedbackPanel } from "@/components/recitation/ai-feedback";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { expectedText, listReviewQueue } from "@/server/dal/recitations";
import { requireRole } from "@/server/session";
import { ReviewForm } from "../_components/review-form";

export default async function TutorReviewsPage() {
  const t = await getTranslations("recitation");
  if (!isDbConfigured()) return <PageHeader title={t("reviewsTitle")} />;

  const user = await requireRole("tutor", "admin");
  const format = await getFormatter();
  const queue = await listReviewQueue(user);
  const expected = await Promise.all(queue.map((q) => expectedText(q.surah, q.ayahFrom, q.ayahTo)));

  return (
    <>
      <PageHeader title={t("reviewsTitle")} description={t("reviewsSubtitle", { count: queue.length })} />
      {queue.length === 0 ? (
        <EmptyState title={t("queueEmpty")} description={t("queueEmptyHint")} />
      ) : (
        <div className="grid gap-6">
          {queue.map((q, i) => {
            const exp = expected[i]!;
            return (
              <Card key={q.id} className="grid gap-5 p-5 lg:grid-cols-2">
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="font-semibold">
                      {q.studentName} · {q.surahName} <span className="quran text-base text-muted">{q.surahNameAr}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {t("ayahRange", { from: q.ayahFrom, to: q.ayahTo })} · {format.dateTime(q.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  {q.audioUrl ? <audio controls preload="none" src={q.audioUrl} className="w-full" /> : <p className="text-sm text-danger">{t("audioUnavailable")}</p>}
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted">{t("expectedText")}</p>
                    <p className="quran text-2xl leading-loose" dir="rtl">
                      {exp.uthmani || t("textNotSeeded")}
                    </p>
                  </div>
                  <AiFeedbackPanel feedback={q.ai} expected={exp.uthmani ? exp : null} canRetry />
                </div>
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-semibold">{t("yourReview")}</p>
                  <ReviewForm recitationId={q.id} hasHifzEntry={Boolean(q.hifzEntryId)} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <p className="mt-6 text-xs text-muted">{t("attribution")}</p>
    </>
  );
}
