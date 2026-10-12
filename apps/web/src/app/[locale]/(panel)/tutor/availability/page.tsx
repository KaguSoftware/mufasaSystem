import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { pageUser } from "@/components/account/page-user";
import { fmtDateTime } from "@/components/live/format";
import { getMyAvailability } from "@/server/dal/live-bookings";
import { AvailabilityEditor } from "./_components/availability-editor";

export default async function TutorAvailabilityPage() {
  const [t, locale, user] = await Promise.all([getTranslations("live"), getLocale(), pageUser()]);
  if (!user || user.role !== "tutor") return <PageHeader title={t("availabilityTitle")} />;
  const av = await getMyAvailability(user);
  return (
    <>
      <PageHeader title={t("availabilityTitle")} description={t("availabilitySubtitle", { tz: av.timezone })} />
      <AvailabilityEditor
        ranges={av.ranges}
        locale={locale}
        defaultStart={av.suggestedStart}
        exceptions={av.exceptions.map((e) => ({
          id: e.id,
          kind: e.kind,
          label: `${fmtDateTime(e.startsAt, av.timezone, locale)} - ${fmtDateTime(e.endsAt, av.timezone, locale)}`,
        }))}
      />
    </>
  );
}
