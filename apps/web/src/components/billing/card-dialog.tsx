"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatMoney } from "@/lib/billing-math";
import { startCardCheckoutAction } from "@/server/actions/billing";
import { useAction } from "./use-action";
import type { LearnerOption, PlanView } from "./types";

/** iyzico returns an HTML+script snippet; scripts inserted via innerHTML do not run, so recreate them. */
function IyzicoForm({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = "";
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    for (const node of Array.from(tmp.childNodes)) {
      if (node instanceof HTMLScriptElement) {
        const s = document.createElement("script");
        for (const a of Array.from(node.attributes)) s.setAttribute(a.name, a.value);
        s.text = node.text;
        host.appendChild(s);
      } else {
        host.appendChild(node.cloneNode(true));
      }
    }
  }, [html]);
  return <div ref={ref} id="iyzipay-checkout-form" className="responsive min-h-48" />;
}

export function CardDialog({
  open,
  onOpenChange,
  plans,
  learners,
  initialPlanId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plans: PlanView[];
  learners: LearnerOption[];
  initialPlanId?: string | null;
}) {
  const t = useTranslations("billing.card");
  const tp = useTranslations("billing.pay");
  const tc = useTranslations("common");
  const locale = useLocale();
  const run = useAction();

  const cardPlans = plans.filter((p) => p.cardAvailable);
  const [planId, setPlanId] = useState<string | null>(initialPlanId ?? null);
  const [learnerIds, setLearnerIds] = useState<string[]>(learners.length === 1 ? [learners[0]!.id] : []);
  const [identityNumber, setIdentityNumber] = useState("");
  const [gsmNumber, setGsmNumber] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [html, setHtml] = useState<string | null>(null);

  const plan = cardPlans.find((p) => p.id === planId) ?? null;
  const valid = Boolean(plan) && learnerIds.length > 0 && /^\d{11}$/.test(identityNumber);

  async function go() {
    if (!planId) return;
    setBusy(true);
    try {
      const res = await run(
        () =>
          startCardCheckoutAction({
            planId,
            learnerIds: plan && learnerIds.length > plan.seats ? learnerIds.slice(0, plan.seats) : learnerIds,
            identityNumber,
            gsmNumber: gsmNumber || undefined,
            address: address || undefined,
            city: city || undefined,
          }),
        { refresh: false },
      );
      if (res.ok) setHtml(res.data.checkoutFormContent);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setHtml(null);
        onOpenChange(v);
      }}
    >
      <DialogContent title={t("title")} description={t("description")} size="lg">
        {html ? (
          <IyzicoForm html={html} />
        ) : cardPlans.length === 0 ? (
          <p className="text-sm text-muted">{t("unavailable")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <Field label={tp("plan")} required>
              <Select
                options={cardPlans.map((p) => ({ value: p.id, label: p.name, description: formatMoney(p.priceMinor, p.currency, locale) }))}
                value={planId}
                onChange={setPlanId}
                placeholder={tp("selectPlan")}
              />
            </Field>
            <Field label={tp("learners")} required hint={plan && plan.seats > 1 ? tp("seatsLimit", { count: plan.seats }) : undefined}>
              <Select
                multiple
                options={learners.map((l) => ({ value: l.id, label: l.name }))}
                value={learnerIds}
                onChange={setLearnerIds}
                placeholder={tp("selectLearners")}
              />
            </Field>
            <Field label={t("identityNumber")} hint={t("identityHint")} required>
              <Input inputMode="numeric" maxLength={11} value={identityNumber} onChange={(e) => setIdentityNumber(e.target.value.replace(/\D/g, ""))} dir="ltr" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("phone")}>
                <Input type="tel" value={gsmNumber} onChange={(e) => setGsmNumber(e.target.value)} dir="ltr" />
              </Field>
              <Field label={t("city")}>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
            </div>
            <Field label={t("address")}>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">{tc("cancel")}</Button>
              </DialogClose>
              <Button onClick={go} loading={busy} disabled={!valid || busy}>
                {t("continue")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
