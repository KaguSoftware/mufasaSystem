"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ClipboardCheck, Pencil, Plus, Video, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import {
  cancelSession,
  editSession,
  fetchSessionDetail,
  markAllPresent,
  markAttendance,
  respondToBooking,
  scheduleSessions,
} from "@/server/actions/live";
import { useLiveError } from "@/components/live/use-live-error";
import { SessionStatusBadge } from "@/components/live/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/controls";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

export type BoardSession = {
  id: string;
  title: string;
  groupName: string | null;
  mode: "livekit" | "external_link";
  status: "scheduled" | "live" | "ended" | "cancelled";
  durationMin: number;
  attendeeCount: number;
  dayKey: string;
  dayLabel: string;
  timeLabel: string;
  startsLocal: string;
  open: boolean;
  isPast: boolean;
};
export type BoardBooking = { id: string; studentName: string; whenLabel: string; durationMin: number; note: string | null };

const DURATIONS = [30, 45, 60, 90];

export function SessionsBoard({
  sessions,
  bookings,
  groups,
  liveAvailable,
  timezone,
  defaultStart,
}: {
  sessions: BoardSession[];
  bookings: BoardBooking[];
  groups: { id: string; name: string }[];
  liveAvailable: boolean;
  timezone: string;
  defaultStart: string;
}) {
  const t = useTranslations("live");
  const [scheduling, setScheduling] = useState(false);
  const [editing, setEditing] = useState<BoardSession | null>(null);
  const [attending, setAttending] = useState<BoardSession | null>(null);
  const [cancelling, setCancelling] = useState<BoardSession | null>(null);

  const days = useMemo(() => {
    const m = new Map<string, { label: string; items: BoardSession[] }>();
    for (const s of sessions) {
      const g = m.get(s.dayKey) ?? { label: s.dayLabel, items: [] };
      g.items.push(s);
      m.set(s.dayKey, g);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sessions]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{t("timezoneNote", { tz: timezone })}</p>
        <Button onClick={() => setScheduling(true)} disabled={groups.length === 0}>
          <Plus className="size-4" />
          {t("scheduleSession")}
        </Button>
      </div>

      {bookings.length > 0 && <BookingRequests bookings={bookings} liveAvailable={liveAvailable} />}

      {days.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-8" />}
          title={t("noSessions")}
          description={groups.length === 0 ? t("noGroupsTutorHint") : t("noSessionsHint")}
        />
      ) : (
        days.map(([key, day]) => (
          <section key={key}>
            <h2 className="mb-2 text-sm font-semibold text-muted">{day.label}</h2>
            <Card>
              <ul className="divide-y divide-border">
                {day.items.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.title}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        <span className="tabular-nums">{s.timeLabel}</span> · {t("minutes", { n: s.durationMin })} ·{" "}
                        {s.groupName ?? t("oneToOne")} · {t("attendeesCount", { n: s.attendeeCount })}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{s.mode === "livekit" ? t("modeLivekit") : t("modeExternal")}</Badge>
                      <SessionStatusBadge status={s.status} />
                      {s.open && s.status !== "cancelled" && s.status !== "ended" && (
                        <Button asChild size="sm">
                          <Link href={`/live/${s.id}`}>
                            <Video className="size-4" />
                            {s.status === "live" ? t("join") : t("start")}
                          </Link>
                        </Button>
                      )}
                      {s.status !== "cancelled" && (s.isPast || s.status !== "scheduled") && (
                        <Button size="sm" variant="outline" onClick={() => setAttending(s)}>
                          <ClipboardCheck className="size-4" />
                          {t("attendance")}
                        </Button>
                      )}
                      {s.status === "scheduled" && (
                        <>
                          <Button size="icon" variant="ghost" aria-label={t("editSession")} onClick={() => setEditing(s)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label={t("cancelSession")} onClick={() => setCancelling(s)}>
                            <X className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ))
      )}

      {scheduling && (
        <ScheduleDialog groups={groups} liveAvailable={liveAvailable} defaultStart={defaultStart} onClose={() => setScheduling(false)} />
      )}
      {editing && <EditDialog session={editing} onClose={() => setEditing(null)} />}
      {attending && <AttendanceDialog session={attending} onClose={() => setAttending(null)} />}
      {cancelling && <CancelDialog session={cancelling} onClose={() => setCancelling(null)} />}
    </div>
  );
}

function BookingRequests({ bookings, liveAvailable }: { bookings: BoardBooking[]; liveAvailable: boolean }) {
  const t = useTranslations("live");
  const errText = useLiveError();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [linkFor, setLinkFor] = useState<BoardBooking | null>(null);
  const [url, setUrl] = useState("");

  async function respond(b: BoardBooking, decision: "confirm" | "decline", meetingUrl?: string) {
    setBusy(b.id);
    const res = await respondToBooking({ bookingId: b.id, decision, meetingUrl: meetingUrl ?? null });
    setBusy(null);
    if (!res.ok) return toast.error(errText(res.error));
    toast.success(decision === "confirm" ? t("bookingConfirmedToast") : t("bookingDeclinedToast"));
    setLinkFor(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader title={t("bookingRequests")} description={t("bookingRequestsHint")} />
      <ul className="divide-y divide-border">
        {bookings.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="font-medium">{b.studentName}</p>
              <p className="mt-0.5 text-sm text-muted">
                {b.whenLabel} · {t("minutes", { n: b.durationMin })}
              </p>
              {b.note && <p className="mt-1 text-sm">{b.note}</p>}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                loading={busy === b.id}
                onClick={() => (liveAvailable ? respond(b, "confirm") : setLinkFor(b))}
              >
                <Check className="size-4" />
                {t("confirm")}
              </Button>
              <Button size="sm" variant="outline" disabled={busy === b.id} onClick={() => respond(b, "decline")}>
                {t("decline")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {linkFor && (
        <Dialog open onOpenChange={(o) => !o && setLinkFor(null)}>
          <DialogContent title={t("meetingLinkTitle")} description={t("meetingLinkHint")} size="sm">
            <Field label={t("meetingUrl")}>
              <Input value={url} placeholder="https://meet.google.com/..." onChange={(e) => setUrl(e.target.value)} dir="ltr" />
            </Field>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setLinkFor(null)}>
                {t("close")}
              </Button>
              <Button loading={busy === linkFor.id} onClick={() => respond(linkFor, "confirm", url)} disabled={!url.startsWith("https://")}>
                {t("confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

function ScheduleDialog({
  groups,
  liveAvailable,
  defaultStart,
  onClose,
}: {
  groups: { id: string; name: string }[];
  liveAvailable: boolean;
  defaultStart: string;
  onClose: () => void;
}) {
  const t = useTranslations("live");
  const errText = useLiveError();
  const router = useRouter();
  const [groupId, setGroupId] = useState<string | null>(groups.length === 1 ? groups[0]!.id : null);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState<string | null>(defaultStart);
  const [duration, setDuration] = useState("45");
  const [mode, setMode] = useState<"livekit" | "external_link">(liveAvailable ? "livekit" : "external_link");
  const [url, setUrl] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [weeks, setWeeks] = useState("4");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function submit() {
    if (!groupId || !start) return;
    setBusy(true);
    const res = await scheduleSessions({
      groupId,
      title,
      startsAtLocal: start,
      durationMin: Number(duration),
      mode,
      meetingUrl: mode === "external_link" ? url : null,
      weeks: recurring ? Math.max(2, Number(weeks) || 2) : 1,
    });
    setBusy(false);
    if (!res.ok) {
      setErrors(res.error.fieldErrors ?? {});
      return toast.error(errText(res.error));
    }
    toast.success(t("scheduledToast", { n: res.data.ids.length }));
    router.refresh();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("scheduleSession")} size="md">
        <div className="flex flex-col gap-4">
          <Field label={t("group")} required>
            <Select value={groupId} onChange={setGroupId} options={groups.map((g) => ({ value: g.id, label: g.name }))} />
          </Field>
          <Field label={t("sessionTitle")} error={errors.title} required>
            <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("startsAt")} error={errors.startsAtLocal} required>
              <DatePicker withTime value={start} onChange={setStart} min={new Date()} invalid={Boolean(errors.startsAtLocal)} />
            </Field>
            <Field label={t("duration")}>
              <Select
                value={duration}
                onChange={(v) => setDuration(v ?? "45")}
                searchable={false}
                options={DURATIONS.map((d) => ({ value: String(d), label: t("minutes", { n: d }) }))}
              />
            </Field>
          </div>
          <Field label={t("mode")} hint={liveAvailable ? undefined : t("livekitOff")}>
            <Select
              value={mode}
              onChange={(v) => setMode(v === "livekit" ? "livekit" : "external_link")}
              searchable={false}
              options={[
                { value: "livekit", label: t("modeLivekit"), description: t("modeLivekitHint"), disabled: !liveAvailable },
                { value: "external_link", label: t("modeExternal"), description: t("modeExternalHint") },
              ]}
            />
          </Field>
          {mode === "external_link" && (
            <Field label={t("meetingUrl")} error={errors.meetingUrl ? t("err.https_required") : undefined} required>
              <Input value={url} placeholder="https://meet.google.com/..." onChange={(e) => setUrl(e.target.value)} dir="ltr" />
            </Field>
          )}
          <div className="rounded-md border border-border p-3">
            <Switch checked={recurring} onCheckedChange={setRecurring} label={t("repeatWeekly")} />
            {recurring && (
              <Field label={t("repeatWeeks")} hint={t("repeatWeeksHint")} className="mt-3 max-w-40">
                <Input inputMode="numeric" value={weeks} onChange={(e) => setWeeks(e.target.value.replace(/\D/g, "").slice(0, 2))} />
              </Field>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("close")}
          </Button>
          <Button onClick={submit} loading={busy} disabled={!groupId || !start || title.trim().length < 2}>
            {t("schedule")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ session, onClose }: { session: BoardSession; onClose: () => void }) {
  const t = useTranslations("live");
  const errText = useLiveError();
  const router = useRouter();
  const [title, setTitle] = useState(session.title);
  const [start, setStart] = useState<string | null>(session.startsLocal);
  const [duration, setDuration] = useState(String(session.durationMin));
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!start) return;
    setBusy(true);
    const res = await editSession({
      sessionId: session.id,
      title,
      startsAtLocal: start,
      durationMin: Number(duration),
      meetingUrl: session.mode === "external_link" && url ? url : null,
    });
    setBusy(false);
    if (!res.ok) return toast.error(errText(res.error));
    toast.success(t("sessionSaved"));
    router.refresh();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("editSession")} size="md">
        <div className="flex flex-col gap-4">
          <Field label={t("sessionTitle")}>
            <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("startsAt")}>
              <DatePicker withTime value={start} onChange={setStart} />
            </Field>
            <Field label={t("duration")}>
              <Select
                value={duration}
                onChange={(v) => setDuration(v ?? "45")}
                searchable={false}
                options={[...new Set([...DURATIONS, session.durationMin])]
                  .sort((a, b) => a - b)
                  .map((d) => ({ value: String(d), label: t("minutes", { n: d }) }))}
              />
            </Field>
          </div>
          {session.mode === "external_link" && (
            <Field label={t("meetingUrl")} hint={t("meetingUrlEditHint")}>
              <Input value={url} placeholder="https://meet.google.com/..." onChange={(e) => setUrl(e.target.value)} dir="ltr" />
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("close")}
          </Button>
          <Button
            onClick={submit}
            loading={busy}
            disabled={!start || title.trim().length < 2 || (url !== "" && !url.startsWith("https://"))}
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({ session, onClose }: { session: BoardSession; onClose: () => void }) {
  const t = useTranslations("live");
  const errText = useLiveError();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    const res = await cancelSession({ sessionId: session.id });
    setBusy(false);
    if (!res.ok) return toast.error(errText(res.error));
    toast.success(t("sessionCancelledToast"));
    router.refresh();
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("cancelSession")} description={t("cancelSessionHint", { title: session.title })} size="sm">
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("keep")}
          </Button>
          <Button variant="danger" onClick={confirm} loading={busy}>
            {t("cancelSession")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Attendee = { studentId: string; name: string; status: "expected" | "present" | "late" | "absent" | "excused"; secondsPresent: number };

function AttendanceDialog({ session, onClose }: { session: BoardSession; onClose: () => void }) {
  const t = useTranslations("live");
  const errText = useLiveError();
  const router = useRouter();
  const [rows, setRows] = useState<Attendee[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchSessionDetail({ sessionId: session.id }).then((res) => {
      if (!alive) return;
      if (!res.ok) {
        toast.error(errText(res.error));
        setRows([]);
      } else setRows(res.data.attendees);
    });
    return () => {
      alive = false;
    };
    // errText is stable enough for a one-shot load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  async function mark(studentId: string, status: Attendee["status"]) {
    if (status === "expected") return;
    const prev = rows;
    setRows((r) => r?.map((x) => (x.studentId === studentId ? { ...x, status } : x)) ?? null);
    const res = await markAttendance({ sessionId: session.id, studentId, status });
    if (!res.ok) {
      setRows(prev);
      return toast.error(errText(res.error));
    }
    router.refresh();
  }

  async function allPresent() {
    setBusy(true);
    const res = await markAllPresent({ sessionId: session.id });
    setBusy(false);
    if (!res.ok) return toast.error(errText(res.error));
    setRows((r) => r?.map((x) => (x.status === "expected" ? { ...x, status: "present" } : x)) ?? null);
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("attendance")} description={session.title} size="md">
        {rows === null ? (
          <p className="py-6 text-center text-sm text-muted">{t("loading")}</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{t("noAttendees")}</p>
        ) : (
          <>
            <div className="mb-3 flex justify-end">
              <Button size="sm" variant="outline" onClick={allPresent} loading={busy}>
                <Check className="size-4" />
                {t("markAllPresent")}
              </Button>
            </div>
            <ul className="divide-y divide-border rounded-md border border-border">
              {rows.map((r) => (
                <li key={r.studentId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    {r.secondsPresent > 0 && (
                      <p className="text-xs text-muted">{t("minutesPresent", { n: Math.round(r.secondsPresent / 60) })}</p>
                    )}
                  </div>
                  <div className="w-40">
                    <Select
                      value={r.status}
                      searchable={false}
                      onChange={(v) => v && mark(r.studentId, v as Attendee["status"])}
                      options={[
                        { value: "expected", label: t("att.expected"), disabled: true },
                        { value: "present", label: t("att.present") },
                        { value: "late", label: t("att.late") },
                        { value: "absent", label: t("att.absent") },
                        { value: "excused", label: t("att.excused") },
                      ]}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
