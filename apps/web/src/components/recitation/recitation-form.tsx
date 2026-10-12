"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRunAction } from "@/components/catalog/use-run-action";
import { AyahRangePicker, type RangeValue, type SurahOption } from "@/components/quran/ayah-range-picker";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { submitRecitationAction } from "@/server/actions/recitations";
import { Recorder, type RecordedAudio } from "./recorder";

export type LinkOption = { id: string; label: string; surah: number; from: number; to: number };

export function RecitationForm({
  studentId,
  surahs,
  entries,
  homework,
  aiAvailable,
  preset,
}: {
  studentId: string;
  surahs: SurahOption[];
  entries: LinkOption[];
  homework: LinkOption[];
  /** Flag on, Gemini configured and (for children) parent consent allows AI feedback. */
  aiAvailable: boolean;
  preset?: { homeworkId?: string; entryId?: string };
}) {
  const t = useTranslations("recitation");
  const run = useRunAction();
  const initialHw = homework.find((h) => h.id === preset?.homeworkId);
  const initialEntry = entries.find((e) => e.id === preset?.entryId);
  const start = initialHw ?? initialEntry;
  const [range, setRange] = useState<RangeValue>({ surah: start?.surah ?? null, from: start?.from ?? null, to: start?.to ?? null });
  const [entryId, setEntryId] = useState<string | null>(initialEntry?.id ?? null);
  const [homeworkId, setHomeworkId] = useState<string | null>(initialHw?.id ?? null);
  const [ai, setAi] = useState(aiAvailable);
  const [audio, setAudio] = useState<RecordedAudio | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ surah?: string; from?: string; to?: string; audio?: string }>({});
  const [resetKey, setResetKey] = useState(0);

  function pickLink(option: LinkOption | undefined) {
    if (option) setRange({ surah: option.surah, from: option.from, to: option.to });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!range.surah) next.surah = t("required");
    if (!range.from) next.from = t("required");
    if (!range.to) next.to = t("required");
    if (!audio) next.audio = t("audioRequired");
    setErrors(next);
    if (Object.keys(next).length || !audio) return;

    const form = new FormData();
    form.set("file", audio.file);
    form.set("studentId", studentId);
    form.set("surah", String(range.surah));
    form.set("ayahFrom", String(range.from));
    form.set("ayahTo", String(range.to));
    if (entryId) form.set("hifzEntryId", entryId);
    if (homeworkId) form.set("homeworkId", homeworkId);
    if (audio.durationSec) form.set("durationSec", String(audio.durationSec));
    form.set("requestAi", ai ? "true" : "false");

    setBusy(true);
    const res = await run(() => submitRecitationAction(form), { success: false });
    setBusy(false);
    if (res.ok) {
      toast.success(res.data.aiQueued ? t("submittedWithAi") : t("submitted"));
      setAudio(null);
      setResetKey((k) => k + 1);
      setEntryId(null);
      setHomeworkId(null);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <AyahRangePicker surahs={surahs} value={range} onChange={setRange} errors={errors} idPrefix="rec" disabled={busy} />

      {(entries.length > 0 || homework.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {entries.length > 0 && (
            <Field label={t("linkEntry")} hint={t("optional")}>
              <Select
                clearable
                placeholder={t("none")}
                value={entryId}
                onChange={(v) => {
                  setEntryId(v);
                  pickLink(entries.find((x) => x.id === v));
                }}
                options={entries.map((x) => ({ value: x.id, label: x.label }))}
              />
            </Field>
          )}
          {homework.length > 0 && (
            <Field label={t("linkHomework")} hint={t("optional")}>
              <Select
                clearable
                placeholder={t("none")}
                value={homeworkId}
                onChange={(v) => {
                  setHomeworkId(v);
                  pickLink(homework.find((x) => x.id === v));
                }}
                options={homework.map((x) => ({ value: x.id, label: x.label }))}
              />
            </Field>
          )}
        </div>
      )}

      <div key={resetKey}>
        <Recorder onChange={setAudio} disabled={busy} />
        {errors.audio && <p className="mt-2 text-sm text-danger">{errors.audio}</p>}
      </div>

      {aiAvailable ? (
        <Switch checked={ai} onCheckedChange={setAi} label={t("aiToggle")} />
      ) : (
        <p className="text-xs text-muted">{t("aiUnavailable")}</p>
      )}
      {aiAvailable && <p className="-mt-3 text-xs text-muted">{t("aiToggleHint")}</p>}

      <Button type="submit" loading={busy} className="self-start">
        <Send className="size-4" />
        {t("submit")}
      </Button>
    </form>
  );
}
