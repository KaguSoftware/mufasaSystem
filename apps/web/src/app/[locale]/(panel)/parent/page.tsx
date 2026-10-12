import { BarChart3, UsersRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Announcements } from "@/components/announcements";
import { pageUser } from "@/components/account/page-user";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { listChildren } from "@/server/dal/family";

export default async function ParentOverviewPage() {
  const t = await getTranslations("family");
  const tp = await getTranslations("panel.parent");
  const user = await pageUser();
  const children = user?.role === "parent" ? await listChildren(user) : [];
  return (
    <>
      <PageHeader title={tp("dashboard")} description={t("overviewSubtitle")} />
      <div className="flex flex-col gap-6">
        <Announcements role="parent" />
        {user && children.length === 0 ? (
          <EmptyState
            icon={<UsersRound className="size-8" />}
            title={t("noChildren")}
            description={t("noChildrenHint")}
            action={
              <Button asChild>
                <Link href="/parent/children">{t("addChild")}</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {children.map((c) => (
              <Card key={c.id} className="flex flex-col gap-4 p-5">
                <div className="flex items-center gap-3">
                  <Avatar name={c.displayName} size={44} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.displayName}</p>
                    {c.username && <p className="truncate text-sm text-muted">@{c.username}</p>}
                  </div>
                </div>
                {/* SLOT: other modules add per-child stats here (streak, XP, next class, homework due). */}
                <div data-slot="child-stats" />
                <Button asChild variant="outline" size="sm" className="self-start">
                  <Link href={`/parent/progress?child=${c.id}`}>
                    <BarChart3 className="size-4" />
                    {t("progress")}
                  </Link>
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
