import { Bell } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { Role } from "@mufasa/db";
import { Link } from "@/i18n/navigation";
import { listNotifications } from "@/server/dal/notifications";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { pageUser } from "./page-user";
import { MarkAllReadButton, NotificationRow } from "./notification-row";

/** Shared notifications screen for every role. Text is rendered from message keys in the viewer's locale. */
export async function NotificationsPage({ role, page }: { role: Role; page?: string }) {
  const t = await getTranslations();
  const tp = await getTranslations("account");
  const [locale, user] = await Promise.all([getLocale(), pageUser()]);
  const data = user ? await listNotifications(user, { page: Number(page) || 1 }) : null;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: user?.timezone });

  return (
    <>
      <PageHeader
        title={t("panel.notifications")}
        actions={data && data.items.some((n) => !n.read) ? <MarkAllReadButton label={t("panel.markAllRead")} /> : undefined}
      />
      {!data || data.items.length === 0 ? (
        <EmptyState icon={<Bell className="size-8" />} title={tp("noNotifications")} />
      ) : (
        <Card className="divide-y divide-border">
          {data.items.map((n) => (
            <NotificationRow
              key={n.id}
              id={n.id}
              read={n.read}
              href={n.href}
              text={t(`notifications.${n.type}` as never, n.params as never)}
              time={fmt.format(n.createdAt)}
            />
          ))}
        </Card>
      )}
      {data && pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <Button asChild variant="outline" size="sm" disabled={data.page <= 1}>
            <Link href={`/${role}/notifications?page=${Math.max(1, data.page - 1)}`}>{tp("previous")}</Link>
          </Button>
          <span className="text-muted">
            {data.page} / {pages}
          </span>
          <Button asChild variant="outline" size="sm" disabled={data.page >= pages}>
            <Link href={`/${role}/notifications?page=${Math.min(pages, data.page + 1)}`}>{tp("next")}</Link>
          </Button>
        </div>
      )}
    </>
  );
}
