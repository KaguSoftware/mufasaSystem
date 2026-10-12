"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { cancelBooking, fetchSlots, requestBooking } from "@/server/actions/live";
import { dayKey, fmtDay, fmtTime } from "@/components/live/format";
import { useLiveError } from "@/components/live/use-live-error";
import { slotsCover } from "@/lib/slots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/input";
import { EmptyState, Spinner } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

type Tutor = { id: string; name: string; headline: string | null };
type Child = { id: string; name: string; canJoinLive: boolean };
type Slot = { startsAt: string; endsAt: string };

export function BookingForm({ tutors, kids, timezone }: { tutors: Tutor[]; kids: Child[]; timezone: string }) {
  const t = useTranslations("live");
  const locale = useLocale();
  const errText = useLiveError();
  const router = useRouter();
  const [tutorId, setTutorId] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(kids.length === 1 ? kids[0]!.id : null);
  const [duration, setDuration] = useState<"30" | "60">("30");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [tutorTz, setTutorTz] = useState<string>("UTC");
  const [day, setDay] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const tz = timezone;
  const child = kids.find((c) => c.id === childId);

  useEffect(() => {
    if (!tutorId) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setSlots(null);
    setPicked(null);
    setDay(null);
    void fetchSlots({ tutorId, days: 21 }).then((res) => {
      if (!alive) return;
      setLoading(false);
      if (!res.ok) {
        setSlots([]);
        return toast.error(errText(res.error));
      }
      setSlots(res.data.slots);
      setTutorTz(res.data.timezone);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorId]);

  // Times are shown in the parent's profile timezone.
  const days = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots ?? []) {
      const k = dayKey(s.startsAt, tz);
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [slots, tz]);

  const coverSlots = useMemo(
    () => (slots ?? []).map((s) => ({ startsAt: new Date(s.startsAt), endsAt: new Date(s.endsAt) })),
    [slots],
  );
  const activeDay = days.find(([k]) => k === day) ?? null;
  const consentBlocked = child ? !child.canJoinLive : false;

  async function submit() {
    if (!tutorId || !childId || !picked) return;
    setBusy(true);
    const res = await requestBooking({
      tutorId,
      studentId: childId,
      startsAt: picked,
      durationMin: duration === "60" ? 60 : 30,
      note: note.trim() || null,
    });
    setBusy(false);
    if (!res.ok) return toast.error(errText(res.error));
    toast.success(t("bookingRequestedToast"));
    setPicked(null);
    setNote("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader title={t("bookTitle")} description={t("bookHint")} />
      {tutors.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={<CalendarClock className="size-8" />} title={t("noTutors")} description={t("noTutorsHint")} />
        </div>
      ) : (
        <div className="flex flex-col gap-5 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("tutor")} required>
              <Select
                value={tutorId}
                onChange={setTutorId}
                options={tutors.map((x) => ({ value: x.id, label: x.name, description: x.headline ?? undefined }))}
              />
            </Field>
            <Field label={t("child")} required>
              <Select value={childId} onChange={setChildId} options={kids.map((c) => ({ value: c.id, label: c.name }))} />
            </Field>
            <Field label={t("duration")}>
              <Select
                value={duration}
                searchable={false}
                onChange={(v) => {
                  setDuration(v === "60" ? "60" : "30");
                  setPicked(null);
                }}
                options={[
                  { value: "30", label: t("minutes", { n: 30 }) },
                  { value: "60", label: t("minutes", { n: 60 }) },
                ]}
              />
            </Field>
          </div>
          {consentBlocked && <p className="text-sm text-danger">{t("err.consent_live_video")}</p>}

          {tutorId && loading && <Spinner />}
          {tutorId && slots && (
            <>
              <p className="text-xs text-muted">{t("slotsNote", { tz, tutorTz })}</p>
              {days.length === 0 ? (
                <p className="text-sm text-muted">{t("noSlots")}</p>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-2">
                    {days.map(([k, list]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setDay(k);
                          setPicked(null);
                        }}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-surface-2",
                          day === k ? "border-primary bg-primary-soft text-primary" : "border-border",
                        )}
                      >
                        {fmtDay(list[0]!.startsAt, tz, locale)}
                      </button>
                    ))}
                  </div>
                  {activeDay && (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                      {activeDay[1].map((s) => {
                        const ok = slotsCover(coverSlots, new Date(s.startsAt), Number(duration));
                        return (
                          <button
                            key={s.startsAt}
                            type="button"
                            disabled={!ok}
                            onClick={() => setPicked(s.startsAt)}
                            className={cn(
                              "rounded-md border px-2 py-2 text-sm tabular-nums transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40",
                              picked === s.startsAt ? "border-primary bg-primary text-primary-fg hover:bg-primary-hover" : "border-border",
                            )}
                          >
                            {fmtTime(s.startsAt, tz, locale)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {picked && (
            <div className="flex flex-col gap-4 border-t border-border pt-4">
              <Field label={t("note")} hint={t("noteHint")}>
                <Textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <div>
                <Button onClick={submit} loading={busy} disabled={!childId || consentBlocked}>
                  {t("requestBooking")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

type Item = {
  id: string;
  tutorName: string;
  studentName: string;
  whenLabel: string;
  durationMin: number;
  status: "pending" | "confirmed";
};

export function BookingList({ items }: { items: Item[] }) {
  const t = useTranslations("live");
  const errText = useLiveError();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function cancel(id: string) {
    setBusy(id);
    const res = await cancelBooking({ bookingId: id });
    setBusy(null);
    if (!res.ok) return toast.error(errText(res.error));
    toast.success(t("bookingCancelledToast"));
    router.refresh();
  }

  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader title={t("myBookings")} />
      <ul className="divide-y divide-border">
        {items.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="font-medium">
                {b.studentName} · {b.tutorName}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {b.whenLabel} · {t("minutes", { n: b.durationMin })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={b.status === "confirmed" ? "success" : "warning"}>{t(`bookingStatus.${b.status}`)}</Badge>
              <Button size="sm" variant="outline" loading={busy === b.id} onClick={() => cancel(b.id)}>
                {t("cancelBooking")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
