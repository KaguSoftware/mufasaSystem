import { getTranslations } from "next-intl/server";
import { UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { pageUser } from "@/components/account/page-user";
import { listGroups } from "@/server/dal/live";

/** Read only: admins manage group membership and capacity (/admin/groups). */
export default async function TutorGroupsPage() {
  const [t, user] = await Promise.all([getTranslations("live"), pageUser()]);
  if (!user || (user.role !== "tutor" && user.role !== "admin")) return <PageHeader title={t("myGroupsTitle")} />;
  const groups = await listGroups(user);
  return (
    <>
      <PageHeader title={t("myGroupsTitle")} description={t("myGroupsSubtitle")} />
      {groups.length === 0 ? (
        <EmptyState icon={<UsersRound className="size-8" />} title={t("noGroupsTutor")} description={t("noGroupsTutorHint")} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((g) => (
            <Card key={g.id}>
              <CardHeader
                title={g.name}
                description={t("membersCount", { n: g.members.length, max: g.capacity })}
                actions={!g.active ? <Badge>{t("inactive")}</Badge> : undefined}
              />
              <ul className="divide-y divide-border">
                {g.members.length === 0 && <li className="px-5 py-4 text-sm text-muted">{t("noMembers")}</li>}
                {g.members.map((m) => (
                  <li key={m.id} className="px-5 py-2.5 text-sm">
                    {m.name}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
