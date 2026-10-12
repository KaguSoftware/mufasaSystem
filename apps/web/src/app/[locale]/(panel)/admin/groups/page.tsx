import { getLocale, getTranslations } from "next-intl/server";
import { t18n } from "@mufasa/config/locales";
import { PageHeader } from "@/components/ui/misc";
import { pageUser } from "@/components/account/page-user";
import { groupFormOptions, listGroups } from "@/server/dal/live";
import { GroupsManager } from "./_components/groups-manager";

export default async function AdminGroupsPage() {
  const [t, locale, user] = await Promise.all([getTranslations("live"), getLocale(), pageUser()]);
  if (!user || user.role !== "admin") return <PageHeader title={t("groupsTitle")} />;
  const [groups, options] = await Promise.all([listGroups(user), groupFormOptions(user)]);
  return (
    <>
      <PageHeader title={t("groupsTitle")} description={t("groupsSubtitle")} />
      <GroupsManager
        groups={groups}
        tutors={options.tutors}
        students={options.students}
        programs={options.programs.map((p) => ({ id: p.id, label: t18n(p.name, locale) }))}
        courses={options.courses.map((c) => ({ id: c.id, programId: c.programId, label: t18n(c.title, locale) }))}
      />
    </>
  );
}
