import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { pageUser } from "@/components/account/page-user";
import { dayKey, fmtDay, fmtTime, fmtDateTime, toLocalInput } from "@/components/live/format";
import { windowState } from "@/lib/live-window";
import { listGroups, liveModeAvailable, tutorSessionsBetween } from "@/server/dal/live";
import { listBookings } from "@/server/dal/live-bookings";
import { SessionsBoard, type BoardBooking, type BoardSession } from "./_components/sessions-board";

const DAY = 86_400_000;

export default async function TutorSessionsPage() {
  const [t, locale, user] = await Promise.all([getTranslations("live"), getLocale(), pageUser()]);
  if (!user || (user.role !== "tutor" && user.role !== "admin")) return <PageHeader title={t("sessionsTitle")} />;
  const now = new Date();
  const [sessions, groups, bookings, liveOk] = await Promise.all([
    tutorSessionsBetween(user, new Date(now.getTime() - 7 * DAY), new Date(now.getTime() + 90 * DAY)),
    listGroups(user),
    user.role === "tutor" ? listBookings(user) : Promise.resolve([]),
    liveModeAvailable(user),
  ]);
  const tz = user.timezone;
  const board: BoardSession[] = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    groupName: s.groupName,
    mode: s.mode,
    status: s.status,
    durationMin: s.durationMin,
    attendeeCount: s.attendeeCount ?? 0,
    dayKey: dayKey(s.startsAt, tz),
    dayLabel: fmtDay(s.startsAt, tz, locale),
    timeLabel: fmtTime(s.startsAt, tz, locale),
    startsLocal: toLocalInput(s.startsAt, tz),
    open: windowState(s.startsAt, s.durationMin, now) === "open",
    isPast: s.startsAt.getTime() < now.getTime(),
  }));
  const reqs: BoardBooking[] = bookings
    .filter((b) => b.status === "pending")
    .map((b) => ({
      id: b.id,
      studentName: b.studentName,
      whenLabel: fmtDateTime(b.startsAt, tz, locale),
      durationMin: b.durationMin,
      note: b.note,
    }));
  return (
    <>
      <PageHeader title={t("sessionsTitle")} description={t("sessionsSubtitle")} />
      <SessionsBoard
        sessions={board}
        bookings={reqs}
        groups={groups.filter((g) => g.active).map((g) => ({ id: g.id, name: g.name }))}
        liveAvailable={liveOk}
        timezone={tz}
        defaultStart={toLocalInput(new Date(Math.ceil((now.getTime() + 3600_000) / 1_800_000) * 1_800_000), tz)}
      />
    </>
  );
}
