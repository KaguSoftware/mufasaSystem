import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { pageUser } from "@/components/account/page-user";
import { fmtDateTime } from "@/components/live/format";
import { UpcomingSessions } from "@/components/live/upcoming-sessions";
import { bookableTutors, listBookings } from "@/server/dal/live-bookings";
import { listChildren } from "@/server/dal/family";
import { BookingForm, BookingList } from "./_components/booking-form";

export default async function ParentBookingsPage() {
  const [t, locale, user] = await Promise.all([getTranslations("live"), getLocale(), pageUser()]);
  if (!user || user.role !== "parent") return <PageHeader title={t("bookingsTitle")} />;
  const [children, tutors, bookings] = await Promise.all([listChildren(user), bookableTutors(user), listBookings(user)]);
  return (
    <>
      <PageHeader title={t("bookingsTitle")} description={t("bookingsSubtitle")} />
      <div className="flex flex-col gap-6">
        <UpcomingSessions user={user} limit={10} title={t("childrenClasses")} />
        <BookingForm
          tutors={tutors.map((x) => ({ id: x.id, name: x.name, headline: x.headline }))}
          timezone={user.timezone}
          kids={children.map((c) => ({ id: c.id, name: c.displayName, canJoinLive: c.consent?.allowLiveVideo ?? false }))}
        />
        <BookingList
          items={bookings
            .filter((b) => b.status === "pending" || b.status === "confirmed")
            .map((b) => ({
              id: b.id,
              tutorName: b.tutorName,
              studentName: b.studentName,
              whenLabel: fmtDateTime(b.startsAt, user.timezone, locale),
              durationMin: b.durationMin,
              status: b.status as "pending" | "confirmed",
            }))}
        />
      </div>
    </>
  );
}
