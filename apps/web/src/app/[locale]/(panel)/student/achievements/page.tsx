import { Flame, Snowflake, Star, Trophy } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { isDbConfigured } from "@mufasa/db";
import { t18n } from "@mufasa/config/locales";
import { BadgeIcon } from "@/components/gamification/badge-icon";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { achievements } from "@/server/dal/learn";
import { requireUser } from "@/server/session";

export default async function AchievementsPage() {
  const t = await getTranslations("gamification");
  if (!isDbConfigured()) return <PageHeader title={t("title")} />;

  const user = await requireUser();
  const locale = await getLocale();
  const format = await getFormatter();
  const data = await achievements(user, user.id);
  const earnedCount = data.badges.filter((b) => b.earnedAt).length;

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle", { earned: earnedCount, total: data.badges.length })} />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("totalXp")} value={data.totalXp} icon={<Star className="size-4 text-warning" />} />
        <Stat label={t("currentStreak")} value={t("days", { count: data.streak.current })} icon={<Flame className="size-4 text-warning" />} />
        <Stat label={t("longestStreak")} value={t("days", { count: data.streak.longest })} icon={<Trophy className="size-4 text-warning" />} />
        <Stat
          label={t("streakFreeze")}
          value={data.streak.freezesAvailable}
          hint={t("streakFreezeHint")}
          icon={<Snowflake className="size-4 text-primary" />}
        />
      </div>

      <h2 className="mb-4 text-lg font-semibold">{t("badges")}</h2>
      {data.badges.length === 0 ? (
        <p className="text-sm text-muted">{t("noBadgesDefined")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.badges.map((b) => (
            <Card key={b.id} className={cn(!b.earnedAt && "bg-surface-2")}>
              <CardBody className="flex flex-col items-center gap-2 text-center">
                <BadgeIcon name={b.icon} earned={Boolean(b.earnedAt)} />
                <p className="font-medium">{t18n(b.name, locale)}</p>
                <p className="text-xs text-muted">{t18n(b.description, locale)}</p>
                <p className={cn("text-xs", b.earnedAt ? "text-success" : "text-muted")}>
                  {b.earnedAt
                    ? t("earnedOn", { date: format.dateTime(b.earnedAt, { dateStyle: "medium" }) })
                    : t("locked")}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {data.recentXp.length > 0 && (
        <Card className="mt-8">
          <CardHeader title={t("recentXp")} />
          <ul className="divide-y divide-border">
            {data.recentXp.map((e, i) => (
              <li key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                <span>{t(`reason_${e.reason}`)}</span>
                <span className="flex items-center gap-4">
                  <span className="text-xs text-muted">{format.dateTime(e.createdAt, { dateStyle: "medium" })}</span>
                  <span className="font-medium tabular-nums text-success">+{e.amount}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
