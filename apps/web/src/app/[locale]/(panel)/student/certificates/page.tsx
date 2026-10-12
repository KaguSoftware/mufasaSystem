import { Award } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { t18n } from "@mufasa/config/locales";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { pageUser } from "@/components/account/page-user";
import { myCertificates } from "@/server/dal/certificates";
import { isEnabled } from "@/server/flags";
import { DownloadButton } from "./_components/download-button";

export default async function StudentCertificatesPage() {
  const [t, locale, format, user] = await Promise.all([
    getTranslations("certificates"),
    getLocale(),
    getFormatter(),
    pageUser(),
  ]);
  if (!user) return <PageHeader title={t("title")} />;

  const enabled = await isEnabled("certificates", user);
  const items = enabled ? await myCertificates(user, user.id) : [];

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {items.length === 0 ? (
        <EmptyState icon={<Award className="size-8" />} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((c) => (
            <Card key={c.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-soft text-text">
                  <Award className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{t18n(c.title, locale)}</p>
                  <p className="text-xs text-muted">
                    {t("issuedOn", { date: format.dateTime(c.issuedAt, { dateStyle: "medium" }) })}
                    <span className="mx-2">&middot;</span>
                    <span dir="ltr">{t("code", { code: c.code })}</span>
                  </p>
                </div>
              </div>
              {c.revoked ? (
                <Badge tone="danger">{t("revoked")}</Badge>
              ) : (
                <DownloadButton id={c.id} ready={c.pdfReady} />
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
