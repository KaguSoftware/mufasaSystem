import { BadgeCheck, ShieldX } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { brand } from "@mufasa/config/brand";
import { t18n } from "@mufasa/config/locales";
import { Card, CardBody } from "@/components/ui/card";
import { asLocale } from "@/i18n/routing";
import { verifyCertificate } from "@/server/dal/certificates";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Public certificate verification. No session; shows first name, title, date and status only. */
export default async function VerifyCertificatePage({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale: rawLocale, code } = await params;
  const locale = asLocale(rawLocale);
  setRequestLocale(locale);
  const [t, format, cert] = await Promise.all([
    getTranslations("certificates"),
    getFormatter(),
    verifyCertificate(decodeURIComponent(code)),
  ]);

  const valid = cert?.status === "valid";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <p className="text-sm font-semibold tracking-wide text-muted">{brand.name}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("verifyTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("verifyLead")}</p>
      </div>

      <Card>
        <CardBody className="flex flex-col items-center gap-4 text-center">
          {cert ? (
            <>
              {valid ? <BadgeCheck className="size-10 text-success" /> : <ShieldX className="size-10 text-danger" />}
              <p className={valid ? "text-lg font-semibold text-success" : "text-lg font-semibold text-danger"}>
                {valid ? t("verifyValid") : t("verifyRevoked")}
              </p>
              <dl className="grid w-full gap-3 text-start text-sm">
                <Row label={t("verifyRecipient")} value={cert.recipientFirstName} />
                <Row label={t("verifyCertificate")} value={t18n(cert.title, locale)} />
                <Row label={t("verifyIssued")} value={format.dateTime(cert.issuedAt, { dateStyle: "long" })} />
                <Row label={t("verifyCode")} value={<span dir="ltr">{decodeURIComponent(code).toUpperCase()}</span>} />
              </dl>
            </>
          ) : (
            <>
              <ShieldX className="size-10 text-muted" />
              <p className="text-lg font-semibold">{t("verifyNotFound")}</p>
              <p className="text-sm text-muted">{t("verifyNotFoundHint")}</p>
            </>
          )}
        </CardBody>
      </Card>
    </main>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2 last:border-0 last:pb-0">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
