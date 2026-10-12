"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRunAction } from "@/components/catalog/use-run-action";
import { AyahRangePicker, AyahSelect, SurahSelect, type RangeValue, type SurahOption } from "@/components/quran/ayah-range-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createEntryAction,
  createPlanAction,
  deleteEntryAction,
  deletePlanAction,
  updateEntryAction,
  updatePlanAction,
} from "@/server/actions/hifz";

type Status = "learning" | "memorized" | "needs_review";

export type PlanItem = {
  id: string;
  title: string;
  fromSurah: number;
  fromAyah: number;
  toSurah: number;
  toAyah: number | null;
  weeklyTarget: number;
  direction: "forward" | "backward";
  status: "active" | "paused" | "completed";
};

export type EntryItem = {
  id: string;
  planId: string | null;
  surah: number;
  ayahFrom: number;
  ayahTo: number;
  status: Status;
  grade: number | null;
  note: string | null;
};

// ───────────── Plan dialog ─────────────

export function PlanDialog({ studentId, surahs, plan }: { studentId: string; surahs: SurahOption[]; plan?: PlanItem }) {
  const t = useTranslations("hifz");
  const run = useRunAction();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(plan?.title ?? "");
  const [fromSurah, setFromSurah] = useState<number | null>(plan?.fromSurah ?? null);
  const [fromAyah, setFromAyah] = useState<number | null>(plan?.fromAyah ?? 1);
  const [toSurah, setToSurah] = useState<number | null>(plan?.toSurah ?? null);
  const [toAyah, setToAyah] = useState<number | null>(plan?.toAyah ?? null);
  const [weekly, setWeekly] = useState(String(plan?.weeklyTarget ?? 5));
  const [direction, setDirection] = useState<"forward" | "backward">(plan?.direction ?? "backward");
  const [status, setStatus] = useState<"active" | "paused" | "completed">(plan?.status ?? "active");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const count = (n: number | null) => surahs.find((s) => s.number === n)?.ayahCount ?? 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = t("required");
    if (!fromSurah) next.fromSurah = t("required");
    if (!toSurah) next.toSurah = t("required");
    if (fromSurah && toSurah && toSurah < fromSurah) next.toSurah = t("invalidRange");
    const target = Number(weekly);
    if (!Number.isInteger(target) || target < 1 || target > 100) next.weekly = t("invalidWeekly");
    setErrors(next);
    if (Object.keys(next).length) return;

    const body = {
      title: title.trim(),
      fromSurah: fromSurah!,
      fromAyah: fromAyah ?? 1,
      toSurah: toSurah!,
      toAyah,
      weeklyTarget: target,
      direction,
      status,
    };
    setBusy(true);
    const res = plan
      ? await run(() => updatePlanAction({ planId: plan.id, patch: body }), { success: t("saved") })
      : await run(() => createPlanAction({ studentId, ...body }), { success: t("saved") });
    setBusy(false);
    if (res.ok) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {plan ? (
          <Button size="sm" variant="ghost">
            <Pencil className="size-4" />
            {t("editPlan")}
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" />
            {t("addPlan")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={plan ? t("editPlan") : t("addPlan")} description={t("planHint")} size="lg">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label={t("planTitle")} error={errors.title} htmlFor="plan-title" required>
            <Input id="plan-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("fromSurah")} error={errors.fromSurah} htmlFor="plan-fs" required>
              <SurahSelect id="plan-fs" surahs={surahs} value={fromSurah} onChange={(v) => { setFromSurah(v); setFromAyah(1); }} />
            </Field>
            <Field label={t("fromAyah")} htmlFor="plan-fa">
              <AyahSelect id="plan-fa" count={count(fromSurah)} value={fromAyah} onChange={setFromAyah} />
            </Field>
            <Field label={t("toSurah")} error={errors.toSurah} htmlFor="plan-ts" required>
              <SurahSelect id="plan-ts" surahs={surahs} value={toSurah} onChange={(v) => { setToSurah(v); setToAyah(null); }} />
            </Field>
            <Field label={t("toAyah")} hint={t("toAyahHint")} htmlFor="plan-ta">
              <AyahSelect id="plan-ta" clearable placeholder={t("endOfSurah")} count={count(toSurah)} value={toAyah} onChange={setToAyah} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("weeklyTarget")} hint={t("weeklyTargetHint")} error={errors.weekly} htmlFor="plan-weekly">
              <Input id="plan-weekly" inputMode="numeric" value={weekly} onChange={(e) => setWeekly(e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label={t("direction")}>
              <Select
                value={direction}
                onChange={(v) => v && setDirection(v as "forward" | "backward")}
                options={[
                  { value: "backward", label: t("backward") },
                  { value: "forward", label: t("forward") },
                ]}
              />
            </Field>
            {plan && (
              <Field label={t("planStatus")}>
                <Select
                  value={status}
                  onChange={(v) => v && setStatus(v as typeof status)}
                  options={[
                    { value: "active", label: t("planStatus_active") },
                    { value: "paused", label: t("planStatus_paused") },
                    { value: "completed", label: t("planStatus_completed") },
                  ]}
                />
              </Field>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" loading={busy}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeletePlanButton({ planId }: { planId: string }) {
  const t = useTranslations("hifz");
  const run = useRunAction();
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => {
        if (window.confirm(t("confirmDeletePlan"))) void run(() => deletePlanAction({ planId }), { success: t("removed") });
      }}
    >
      <Trash2 className="size-4" />
      {t("delete")}
    </Button>
  );
}

// ───────────── Entry dialog ─────────────

export function EntryDialog({
  studentId,
  surahs,
  plans,
  entry,
  canGrade,
}: {
  studentId: string;
  surahs: SurahOption[];
  plans: { id: string; title: string }[];
  entry?: EntryItem;
  /** Tutors/admins can set status and grade; parents can only add "learning" entries. */
  canGrade: boolean;
}) {
  const t = useTranslations("hifz");
  const run = useRunAction();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState<RangeValue>({ surah: entry?.surah ?? null, from: entry?.ayahFrom ?? null, to: entry?.ayahTo ?? null });
  const [status, setStatus] = useState<Status>(entry?.status ?? "learning");
  const [grade, setGrade] = useState<string | null>(entry?.grade ? String(entry.grade) : null);
  const [planId, setPlanId] = useState<string | null>(entry?.planId ?? null);
  const [note, setNote] = useState(entry?.note ?? "");
  const [errors, setErrors] = useState<{ surah?: string; from?: string; to?: string }>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!range.surah) next.surah = t("required");
    if (!range.from) next.from = t("required");
    if (!range.to) next.to = t("required");
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const res = entry
      ? await run(
          () =>
            updateEntryAction({
              entryId: entry.id,
              patch: {
                ayahFrom: range.from!,
                ayahTo: range.to!,
                note: note.trim() || null,
                ...(canGrade ? { status, grade: grade ? Number(grade) : null } : {}),
              },
            }),
          { success: t("saved") },
        )
      : await run(
          () =>
            createEntryAction({
              studentId,
              planId,
              surah: range.surah!,
              ayahFrom: range.from!,
              ayahTo: range.to!,
              note: note.trim() || null,
              ...(canGrade ? { status, grade: grade ? Number(grade) : null } : {}),
            }),
          { success: t("saved") },
        );
    setBusy(false);
    if (res.ok) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {entry ? (
          <Button size="sm" variant="ghost">
            <Pencil className="size-4" />
            {t("edit")}
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" />
            {t("addEntry")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={entry ? t("editEntry") : t("addEntry")} description={t("entryHint")} size="lg">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <AyahRangePicker surahs={surahs} value={range} onChange={setRange} errors={errors} idPrefix="entry" lockSurah={Boolean(entry)} />
          {entry && <p className="-mt-2 text-xs text-muted">{t("surahLocked")}</p>}
          <div className="grid gap-4 sm:grid-cols-3">
            {canGrade && (
              <>
                <Field label={t("status")}>
                  <Select
                    value={status}
                    onChange={(v) => v && setStatus(v as Status)}
                    options={[
                      { value: "learning", label: t("status_learning") },
                      { value: "memorized", label: t("status_memorized") },
                      { value: "needs_review", label: t("status_needs_review") },
                    ]}
                  />
                </Field>
                <Field label={t("grade")} hint={t("gradeHint")}>
                  <Select
                    clearable
                    placeholder={t("noGrade")}
                    value={grade}
                    onChange={setGrade}
                    options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
                  />
                </Field>
              </>
            )}
            {!entry && plans.length > 0 && (
              <Field label={t("plan")}>
                <Select
                  clearable
                  placeholder={t("withoutPlan")}
                  value={planId}
                  onChange={setPlanId}
                  options={plans.map((p) => ({ value: p.id, label: p.title }))}
                />
              </Field>
            )}
          </div>
          <Field label={t("note")}>
            <Textarea value={note} maxLength={500} rows={2} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="submit" loading={busy}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function QuickStatusButtons({ entryId, status }: { entryId: string; status: Status }) {
  const t = useTranslations("hifz");
  const run = useRunAction();
  const set = (next: Status) => run(() => updateEntryAction({ entryId, patch: { status: next } }), { success: t("saved") });
  return (
    <div className="flex flex-wrap gap-1">
      {status !== "memorized" && (
        <Button size="sm" variant="secondary" onClick={() => set("memorized")}>
          {t("markMemorized")}
        </Button>
      )}
      {status !== "needs_review" && (
        <Button size="sm" variant="ghost" onClick={() => set("needs_review")}>
          {t("markNeedsReview")}
        </Button>
      )}
    </div>
  );
}

export function DeleteEntryButton({ entryId }: { entryId: string }) {
  const t = useTranslations("hifz");
  const run = useRunAction();
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={t("delete")}
      onClick={() => {
        if (window.confirm(t("confirmDeleteEntry"))) void run(() => deleteEntryAction({ entryId }), { success: t("removed") });
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
