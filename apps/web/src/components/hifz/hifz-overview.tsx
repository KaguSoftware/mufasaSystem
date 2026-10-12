import { useTranslations } from "next-intl";
import type { SurahOption } from "@/components/quran/ayah-range-picker";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { EmptyState, Progress } from "@/components/ui/misc";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import type { HifzOverview } from "@/server/dal/hifz";
import { DeleteEntryButton, DeletePlanButton, EntryDialog, PlanDialog, QuickStatusButtons } from "./hifz-manager";

const TONE: Record<"learning" | "memorized" | "needs_review", BadgeTone> = {
  learning: "primary",
  memorized: "success",
  needs_review: "warning",
};

/**
 * The hifz tracker for one student. `manage`: "staff" (tutor/admin: status, grade, plans),
 * "parent" (plans and learning entries), or null for read-only (the student).
 */
export function HifzOverviewView({
  overview,
  surahs,
  manage,
}: {
  overview: HifzOverview;
  surahs: SurahOption[];
  manage: "staff" | "parent" | null;
}) {
  const t = useTranslations("hifz");
  const surahBy = new Map(surahs.map((s) => [s.number, s]));
  const { totals, activePlan } = overview;
  const plans = overview.plans.map((p) => ({ id: p.id, title: p.title }));
  const juzWithProgress = overview.juz.filter((j) => j.memorized > 0).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("memorizedAyahs")} value={totals.memorized} hint={t("ofTotal", { total: totals.total, percent: totals.percent })} />
        <Stat label={t("learningAyahs")} value={totals.learning} />
        <Stat label={t("needsReviewAyahs")} value={totals.needsReview} />
        <Stat label={t("juzStarted")} value={`${juzWithProgress}/30`} />
      </div>

      <Card>
        <CardHeader
          title={t("currentPlan")}
          actions={
            manage && (
              <div className="flex items-center gap-1">
                {activePlan && <PlanDialog studentId={overview.studentId} surahs={surahs} plan={toPlanItem(activePlan.plan)} />}
                {activePlan && <DeletePlanButton planId={activePlan.plan.id} />}
                <PlanDialog studentId={overview.studentId} surahs={surahs} />
              </div>
            )
          }
        />
        <CardBody>
          {!activePlan ? (
            <p className="text-sm text-muted">{t("noPlan")}</p>
          ) : (
            <div className="grid gap-4">
              <div>
                <p className="font-medium">{activePlan.plan.title}</p>
                <p className="text-sm text-muted">
                  {surahBy.get(activePlan.plan.fromSurah)?.nameTranslit} {activePlan.plan.fromAyah} {t("to")}{" "}
                  {surahBy.get(activePlan.plan.toSurah)?.nameTranslit} {activePlan.plan.toAyah ?? t("endOfSurah")} ·{" "}
                  {t(activePlan.plan.direction)}
                </p>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{t("planProgress")}</span>
                  <span className="tabular-nums text-muted">
                    {activePlan.planDone}/{activePlan.planTotal} ({activePlan.planPercent}%)
                  </span>
                </div>
                <Progress value={activePlan.planPercent} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{t("thisWeek")}</span>
                  <span className="tabular-nums text-muted">
                    {t("weeklyDone", { done: activePlan.weeklyDone, target: activePlan.weeklyTarget })}
                  </span>
                </div>
                <Progress value={activePlan.weeklyPercent} />
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("surahProgress")} />
        <CardBody>
          {overview.surahs.length === 0 ? (
            <p className="text-sm text-muted">{t("noProgress")}</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {overview.surahs.map((s) => {
                const info = surahBy.get(s.surah);
                return (
                  <li key={s.surah} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">
                        {s.surah}. {info?.nameTranslit} <span className="quran text-base text-muted">{info?.nameAr}</span>
                      </span>
                      <span className="text-xs tabular-nums text-muted">
                        {s.memorized}/{s.total}
                      </span>
                    </div>
                    <Progress value={s.percent} />
                    {(s.learning > 0 || s.needsReview > 0) && (
                      <p className="text-xs text-muted">
                        {s.learning > 0 && t("learningCount", { count: s.learning })}
                        {s.learning > 0 && s.needsReview > 0 && " · "}
                        {s.needsReview > 0 && t("reviewCount", { count: s.needsReview })}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("juzSummary")} description={t("juzSummaryHint")} />
        <CardBody>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {overview.juz.map((j) => (
              <div
                key={j.juz}
                className="flex flex-col items-center gap-1 rounded-md border border-border p-2 text-center"
                title={`${t("juzLabel", { n: j.juz })}: ${j.memorized}/${j.total}`}
              >
                <span className="text-xs text-muted">{j.juz}</span>
                <Progress value={j.percent} className="h-1.5" />
                <span className="text-[11px] tabular-nums">{j.percent}%</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("entries")}
          actions={manage && <EntryDialog studentId={overview.studentId} surahs={surahs} plans={plans} canGrade={manage === "staff"} />}
        />
        {overview.entries.length === 0 ? (
          <CardBody>
            <EmptyState title={t("noEntries")} description={t("noEntriesHint")} />
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <Tr>
                  <Th>{t("surah")}</Th>
                  <Th>{t("ayahs")}</Th>
                  <Th>{t("status")}</Th>
                  <Th>{t("grade")}</Th>
                  <Th>{t("note")}</Th>
                  {manage && <Th className="text-end">{t("actions")}</Th>}
                </Tr>
              </THead>
              <TBody>
                {overview.entries.map((e) => (
                  <Tr key={e.id}>
                    <Td>
                      {e.surah}. {surahBy.get(e.surah)?.nameTranslit}
                    </Td>
                    <Td className="tabular-nums">
                      {e.ayahFrom}-{e.ayahTo}
                    </Td>
                    <Td>
                      <Badge tone={TONE[e.status]}>{t(`status_${e.status}`)}</Badge>
                    </Td>
                    <Td className="tabular-nums">{e.grade ?? "-"}</Td>
                    <Td className="max-w-56 truncate text-muted">{e.note}</Td>
                    {manage && (
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          {manage === "staff" && <QuickStatusButtons entryId={e.id} status={e.status} />}
                          <EntryDialog
                            studentId={overview.studentId}
                            surahs={surahs}
                            plans={plans}
                            canGrade={manage === "staff"}
                            entry={{
                              id: e.id,
                              planId: e.planId,
                              surah: e.surah,
                              ayahFrom: e.ayahFrom,
                              ayahTo: e.ayahTo,
                              status: e.status,
                              grade: e.grade,
                              note: e.note,
                            }}
                          />
                          <DeleteEntryButton entryId={e.id} />
                        </div>
                      </Td>
                    )}
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </Card>
      <p className="text-xs text-muted">{t("attribution")}</p>
    </div>
  );
}

function toPlanItem(p: HifzOverview["plans"][number]) {
  return {
    id: p.id,
    title: p.title,
    fromSurah: p.fromSurah,
    fromAyah: p.fromAyah,
    toSurah: p.toSurah,
    toAyah: p.toAyah,
    weeklyTarget: p.weeklyTarget,
    direction: p.direction,
    status: p.status,
  };
}
