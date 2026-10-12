import { getTranslations } from "next-intl/server";
import { isDbConfigured } from "@mufasa/db";
import { PageHeader } from "@/components/ui/misc";
import { accessTargets } from "@/server/dal/access-admin";
import { listAllPlans, listCoupons } from "@/server/dal/billing";
import { requireRole } from "@/server/session";
import { PlansManager } from "./_components/plans-manager";

export default async function AdminPlansPage() {
  const t = await getTranslations("billing.admin");
  if (!isDbConfigured()) return <PageHeader title={t("plansTitle")} />;
  const user = await requireRole("admin");
  const [plans, coupons, targets] = await Promise.all([listAllPlans(user), listCoupons(user), accessTargets(user)]);
  return (
    <>
      <PageHeader title={t("plansTitle")} description={t("plansDescription")} />
      <PlansManager
        plans={plans.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          description: p.description,
          priceMinor: p.priceMinor,
          currency: p.currency,
          interval: p.interval,
          periodDays: p.periodDays,
          programIds: p.programIds,
          seats: p.seats,
          features: p.features,
          iyzicoPricingPlanRef: p.iyzicoPricingPlanRef,
          active: p.active,
          sortOrder: p.sortOrder,
        }))}
        coupons={coupons.map((c) => ({
          id: c.id,
          code: c.code,
          percentOff: c.percentOff,
          amountOffMinor: c.amountOffMinor,
          currency: c.currency,
          maxRedemptions: c.maxRedemptions,
          redemptions: c.redemptions,
          planIds: c.planIds,
          validFrom: c.validFrom?.toISOString() ?? null,
          validUntil: c.validUntil?.toISOString() ?? null,
          active: c.active,
        }))}
        programs={targets.programs}
      />
    </>
  );
}
