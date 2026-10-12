"use client";

import { Check, CreditCard, Landmark } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { formatMoney } from "@/lib/billing-math";
import { CardDialog } from "./card-dialog";
import { PayDialog } from "./pay-dialog";
import type { BankInfo, LearnerOption, PlanView } from "./types";

export function PlansGrid({
  plans,
  learners,
  bank,
  canPay,
  manualEnabled,
  cardEnabled,
}: {
  plans: PlanView[];
  learners: LearnerOption[];
  bank: BankInfo;
  canPay: boolean;
  manualEnabled: boolean;
  cardEnabled: boolean;
}) {
  const t = useTranslations("billing");
  const locale = useLocale();
  const [payPlan, setPayPlan] = useState<string | null>(null);
  const [cardPlan, setCardPlan] = useState<string | null>(null);

  if (plans.length === 0) return <EmptyState title={t("noPlans")} />;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id} className="flex flex-col p-5">
            <h3 className="text-lg font-semibold">{p.name}</h3>
            {p.description && <p className="mt-1 text-sm text-muted">{p.description}</p>}
            <p className="mt-4 text-3xl font-semibold tabular-nums">{formatMoney(p.priceMinor, p.currency, locale)}</p>
            <p className="text-sm text-muted">{t("seatsCount", { count: p.seats })}</p>
            {p.features.length > 0 && (
              <ul className="mt-4 flex flex-col gap-1.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
            {canPay && (
              <div className="mt-5 flex flex-col gap-2 pt-1">
                {manualEnabled && (
                  <Button onClick={() => setPayPlan(p.id)}>
                    <Landmark className="size-4" />
                    {t("payByTransfer")}
                  </Button>
                )}
                {cardEnabled && p.cardAvailable && (
                  <Button variant="outline" onClick={() => setCardPlan(p.id)}>
                    <CreditCard className="size-4" />
                    {t("payByCard")}
                  </Button>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
      {canPay && (
        <>
          <PayDialog
            key={`pay-${payPlan}`}
            open={payPlan !== null}
            onOpenChange={(v) => !v && setPayPlan(null)}
            plans={plans}
            learners={learners}
            bank={bank}
            initialPlanId={payPlan}
          />
          <CardDialog
            key={`card-${cardPlan}`}
            open={cardPlan !== null}
            onOpenChange={(v) => !v && setCardPlan(null)}
            plans={plans}
            learners={learners}
            initialPlanId={cardPlan}
          />
        </>
      )}
    </>
  );
}
