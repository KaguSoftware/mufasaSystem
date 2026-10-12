import { getFormatter, getTranslations } from "next-intl/server";
import { isDbConfigured } from "@mufasa/db";
import { RecitationCard } from "@/components/recitation/recitation-card";
import { RecitationForm } from "@/components/recitation/recitation-form";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { expectedText, listRecitations, recitationFormData } from "@/server/dal/recitations";
import { requireUser } from "@/server/session";

export default async function StudentRecitationsPage({ searchParams }: { searchParams: Promise<{ homework?: string; entry?: string }> }) {
  const t = await getTranslations("recitation");
  if (!isDbConfigured()) return <PageHeader title={t("title")} />;

  const [user, sp, format] = await Promise.all([requireUser(), searchParams, getFormatter()]);
  const [items, form] = await Promise.all([listRecitations(user, user.id), recitationFormData(user, user.id)]);
  const expected = await Promise.all(items.map((i) => (i.ai?.status === "done" ? expectedText(i.surah, i.ayahFrom, i.ayahTo) : null)));

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="flex flex-col gap-8">
        <Card>
          <CardHeader title={t("recordNew")} description={t("recordNewHint")} />
          <CardBody>
            {form.recordingAllowed ? (
              <RecitationForm
                studentId={user.id}
                surahs={form.surahs}
                entries={form.entries}
                homework={form.homework}
                aiAvailable={form.aiAvailable}
                preset={{ homeworkId: sp.homework, entryId: sp.entry }}
              />
            ) : (
              <p className="text-sm text-muted">{t("recordingNotAllowed")}</p>
            )}
          </CardBody>
        </Card>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{t("myRecitations")}</h2>
          {items.length === 0 ? (
            <EmptyState title={t("noRecitations")} description={t("noRecitationsHint")} />
          ) : (
            items.map((item, i) => (
              <RecitationCard
                key={item.id}
                item={item}
                expected={expected[i]}
                canRetryAi={form.aiAvailable}
                dateLabel={format.dateTime(item.createdAt, { dateStyle: "medium" })}
              />
            ))
          )}
          <p className="text-xs text-muted">{t("attribution")}</p>
        </section>
      </div>
    </>
  );
}
