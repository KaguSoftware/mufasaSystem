import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { pageUser } from "@/components/account/page-user";
import { listAllAnnouncements } from "@/server/dal/announcements";
import { AnnouncementsManager } from "./_components/announcements-manager";

function announcementStatus(r: { publishedAt: Date | null; expiresAt: Date | null }, nowMs: number) {
  if (!r.publishedAt) return "draft" as const;
  return r.expiresAt && r.expiresAt.getTime() <= nowMs ? ("expired" as const) : ("live" as const);
}

export default async function AdminAnnouncementsPage() {
  const [t, user] = await Promise.all([getTranslations("admin"), pageUser()]);
  if (!user || user.role !== "admin") return <PageHeader title={t("announcementsTitle")} />;
  const rows = await listAllAnnouncements(user);
  const nowMs = new Date().getTime();
  return (
    <>
      <PageHeader title={t("announcementsTitle")} description={t("announcementsSubtitle")} />
      <AnnouncementsManager
        items={rows.map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          audience: r.audience,
          publishedAt: r.publishedAt?.toISOString() ?? null,
          expiresAt: r.expiresAt?.toISOString() ?? null,
          status: announcementStatus(r, nowMs),
        }))}
      />
    </>
  );
}
