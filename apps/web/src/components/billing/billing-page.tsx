import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { isDbConfigured } from "@mufasa/db";
import { t18n } from "@mufasa/config/locales";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { formatMoney } from "@/lib/billing-math";
import { listActivePlans, myBilling } from "@/server/dal/billing";
import { getPublicSettings } from "@/server/dal/settings";
import { isEnabled } from "@/server/flags";
import { requireUser } from "@/server/session";
import { PlansGrid } from "./plans-grid";
import type { PlanView } from "./types";

const REQUEST_TONE: Record<string, BadgeTone> = { pending: "warning", approved: "success", rejected: "danger" };
const SUB_TONE: Record<string, BadgeTone> = {
  active: "success",
  past_due: "warning",
  pending: "warning",
  cancelled: "neutral",
  expired: "neutral",
};

/** Shared by /parent/billing and /student/billing. */
export async function BillingPage({ status }: { status?: string }) {
  const t = await getTranslations("billing");
  if (!isDbConfigured()) return <PageHeader title={t("title")} description={t("subtitle")} />;

  const [user, locale, fmt] = await Promise.all([requireUser(), getLocale(), getFormatter()]);
  const [billing, plans, settings, manualEnabled, cardEnabled] = await Promise.all([
    myBilling(user),
    listActivePlans(),
    getPublicSettings(),
    isEnabled("manual_payments", user),
    isEnabled("iyzico_checkout", user),
  ]);
  const date = (iso: string) => fmt.dateTime(new Date(iso), { dateStyle: "medium" });
  const canPay = (user.role === "parent" || user.role === "student") && !user.isManagedChild;

  const planViews: PlanView[] = plans.map((p) => ({
    id: p.id,
    name: t18n(p.name, locale),
    description: t18n(p.description, locale),
    priceMinor: p.priceMinor,
    currency: p.currency,
    seats: p.seats,
    periodDays: p.periodDays,
    features: p.features,
    cardAvailable: Boolean(p.iyzicoPricingPlanRef),
  }));

  const returnStatus = status === "success" || status === "failed" || status === "pending" ? status : null;

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />

      {returnStatus && (
        <Card className="mb-6 p-4 text-sm">
          <Badge tone={returnStatus === "success" ? "success" : returnStatus === "failed" ? "danger" : "warning"} className="me-2">
            {t(`status.${returnStatus === "success" ? "active" : returnStatus === "failed" ? "cancelled" : "pending"}`)}
          </Badge>
          {t(`returnStatus.${returnStatus}`)}
        </Card>
      )}

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">{t("learners")}</h2>
        {billing.learners.length === 0 ? (
          <EmptyState title={t("noLearners")} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {billing.learners.map((l) => (
              <Card key={l.id}>
                <CardHeader
                  title={l.name}
                  actions={
                    <Badge tone={l.access.active ? "success" : "neutral"}>
                      {l.access.active ? t("accessActive") : t("accessNone")}
                    </Badge>
                  }
                  description={
                    l.access.active ? (l.access.forever ? t("accessForever") : l.access.until ? t("accessUntil", { date: date(l.access.until) }) : undefined) : undefined
                  }
                />
                <CardBody className="flex flex-col gap-2 text-sm">
                  {l.subscriptions.length === 0 ? (
                    <p className="text-muted">{t("noSubscriptions")}</p>
                  ) : (
                    l.subscriptions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{s.planName}</p>
                          <p className="text-xs text-muted">
                            {t(`source.${s.source}`)}
                            {s.periodEnd ? ` · ${t("renewsOn", { date: date(s.periodEnd) })}` : ""}
                          </p>
                        </div>
                        <Badge tone={SUB_TONE[s.status] ?? "neutral"}>{t(`status.${s.status as "active"}`)}</Badge>
                      </div>
                    ))
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">{t("plans")}</h2>
        <PlansGrid
          plans={planViews}
          learners={billing.learners.map((l) => ({ id: l.id, name: l.name }))}
          bank={{
            iban: settings["payment.iban"],
            accountName: settings["payment.accountName"],
            bankName: settings["payment.bankName"],
            instructions: t18n(settings["payment.instructions"], locale),
            whatsapp: settings["contact.whatsapp"],
          }}
          canPay={canPay && billing.learners.length > 0}
          manualEnabled={manualEnabled}
          cardEnabled={cardEnabled}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("requests.title")}</h2>
        {billing.requests.length === 0 ? (
          <EmptyState title={t("requests.empty")} />
        ) : (
          <Card className="divide-y divide-border">
            {billing.requests.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {r.planName} · {formatMoney(r.amountMinor, r.currency, locale)}
                  </p>
                  <p className="text-xs text-muted">
                    {r.learnerNames.join(", ")}
                    {r.reference ? ` · ${r.reference}` : ""} · {date(r.createdAt)}
                  </p>
                  {r.status === "rejected" && r.reviewNote && (
                    <p className="mt-1 text-xs text-danger">{t("requests.reason", { reason: r.reviewNote })}</p>
                  )}
                </div>
                <Badge tone={REQUEST_TONE[r.status]}>{t(`requests.${r.status}`)}</Badge>
              </div>
            ))}
          </Card>
        )}
      </section>
    </>
  );
}
