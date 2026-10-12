"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { addAvailabilityException, removeAvailabilityException, saveWeeklyAvailability } from "@/server/actions/live";
import { useLiveError } from "@/components/live/use-live-error";
import { validateWeekly, type WeeklyRange } from "@/lib/slots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

type Exception = { id: string; kind: "unavailable" | "extra"; label: string };

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const TIME_OPTIONS = TIMES.map((v) => ({ value: v, label: v }));

function dayName(day: number, locale: string) {
  // 2024-01-07 is a Sunday.
  return new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 7 + day)));
}

/** Custom time picker: a searchable Select of half hour steps. */
function TimeSelect({ value, onChange, invalid }: { value: string; onChange: (v: string) => void; invalid?: boolean }) {
  return (
    <div dir="ltr" className="w-28">
      <Select value={value} onChange={(v) => v && onChange(v)} options={TIME_OPTIONS} searchable invalid={invalid} />
    </div>
  );
}

export function AvailabilityEditor({
  ranges: initial,
  exceptions,
  locale,
  defaultStart,
}: {
  ranges: WeeklyRange[];
  exceptions: Exception[];
  locale: string;
  defaultStart: string;
}) {
  const t = useTranslations("live");
  const errText = useLiveError();
  const router = useRouter();
  const [ranges, setRanges] = useState<WeeklyRange[]>(initial);
  const [saving, setSaving] = useState(false);
  const valid = useMemo(() => validateWeekly(ranges), [ranges]);
  const dirty = JSON.stringify(ranges) !== JSON.stringify(initial);

  function update(index: number, patch: Partial<WeeklyRange>) {
    setRanges((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function save() {
    setSaving(true);
    const res = await saveWeeklyAvailability({ ranges });
    setSaving(false);
    if (!res.ok) return toast.error(errText(res.error));
    toast.success(t("availabilitySaved"));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader
          title={t("weeklyHours")}
          description={t("weeklyHoursHint")}
          actions={
            <Button onClick={save} loading={saving} disabled={!dirty || !valid}>
              {t("save")}
            </Button>
          }
        />
        {!valid && <p className="px-5 pt-3 text-sm text-danger">{t("err.invalid_ranges")}</p>}
        <div className="divide-y divide-border">
          {DAY_ORDER.map((day) => {
            const rows = ranges.map((r, index) => ({ r, index })).filter(({ r }) => r.day === day);
            return (
              <div key={day} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-start">
                <div className="w-36 shrink-0 pt-2 text-sm font-medium">{dayName(day, locale)}</div>
                <div className="flex flex-1 flex-col gap-2">
                  {rows.length === 0 && <p className="pt-2 text-sm text-muted">{t("dayOff")}</p>}
                  {rows.map(({ r, index }) => {
                    const bad = r.end <= r.start;
                    return (
                      <div key={index} className="flex flex-wrap items-center gap-2">
                        <TimeSelect value={r.start} onChange={(v) => update(index, { start: v })} invalid={bad} />
                        <span className="text-muted">-</span>
                        <TimeSelect value={r.end} onChange={(v) => update(index, { end: v })} invalid={bad} />
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={t("removeRange")}
                          onClick={() => setRanges((rs) => rs.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRanges((rs) => [...rs, { day: day as WeeklyRange["day"], start: "16:00", end: "18:00" }])}
                >
                  <Plus className="size-4" />
                  {t("addRange")}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      <ExceptionsCard exceptions={exceptions} defaultStart={defaultStart} />
    </div>
  );
}

function ExceptionsCard({ exceptions, defaultStart }: { exceptions: Exception[]; defaultStart: string }) {
  const t = useTranslations("live");
  const errText = useLiveError();
  const router = useRouter();
  const [kind, setKind] = useState<"unavailable" | "extra">("unavailable");
  const [start, setStart] = useState<string | null>(defaultStart);
  const [end, setEnd] = useState<string | null>(defaultStart.slice(0, 11) + "23:00");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!start || !end) return;
    setBusy(true);
    const res = await addAvailabilityException({ startsAtLocal: start, endsAtLocal: end, kind });
    setBusy(false);
    if (!res.ok) return toast.error(errText(res.error));
    router.refresh();
  }
  async function remove(id: string) {
    const res = await removeAvailabilityException({ id });
    if (!res.ok) return toast.error(errText(res.error));
    router.refresh();
  }

  return (
    <Card>
      <CardHeader title={t("exceptions")} description={t("exceptionsHint")} />
      <div className="grid gap-3 border-b border-border p-5 sm:grid-cols-[10rem_1fr_1fr_auto] sm:items-end">
        <Field label={t("exceptionKind")}>
          <Select
            value={kind}
            searchable={false}
            onChange={(v) => setKind(v === "extra" ? "extra" : "unavailable")}
            options={[
              { value: "unavailable", label: t("kindUnavailable") },
              { value: "extra", label: t("kindExtra") },
            ]}
          />
        </Field>
        <Field label={t("from")}>
          <DatePicker withTime value={start} onChange={setStart} />
        </Field>
        <Field label={t("to")}>
          <DatePicker withTime value={end} onChange={setEnd} />
        </Field>
        <Button onClick={add} loading={busy} disabled={!start || !end}>
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>
      {exceptions.length === 0 ? (
        <p className="p-5 text-sm text-muted">{t("noExceptions")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {exceptions.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
              <div className="flex items-center gap-2">
                <Badge tone={e.kind === "extra" ? "success" : "warning"}>{e.kind === "extra" ? t("kindExtra") : t("kindUnavailable")}</Badge>
                <span>{e.label}</span>
              </div>
              <Button size="icon" variant="ghost" aria-label={t("removeRange")} onClick={() => remove(e.id)}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
