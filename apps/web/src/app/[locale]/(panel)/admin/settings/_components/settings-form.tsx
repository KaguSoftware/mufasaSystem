"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/billing/use-action";
import { updateSettingsAction } from "@/server/actions/settings";
import type { AllSettings } from "@/server/dal/settings";

export function SettingsForm({ initial }: { initial: AllSettings }) {
  const t = useTranslations("billing.settings");
  const tc = useTranslations("common");
  const run = useAction();
  const [v, setV] = useState({
    iban: initial["payment.iban"],
    accountName: initial["payment.accountName"],
    bankName: initial["payment.bankName"],
    instrEn: initial["payment.instructions"].en,
    instrAr: initial["payment.instructions"].ar ?? "",
    instrTr: initial["payment.instructions"].tr ?? "",
    whatsapp: initial["contact.whatsapp"],
    email: initial["contact.email"],
    days: String(initial["billing.reminderDaysBefore"]),
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    try {
      const res = await run(
        () =>
          updateSettingsAction({
            "payment.iban": v.iban,
            "payment.accountName": v.accountName,
            "payment.bankName": v.bankName,
            "payment.instructions": { en: v.instrEn, ar: v.instrAr || undefined, tr: v.instrTr || undefined },
            "contact.whatsapp": v.whatsapp.replace(/\D/g, ""),
            "contact.email": v.email,
            "billing.reminderDaysBefore": Number(v.days),
          }),
        { success: t("saved") },
      );
      setErrors(res.ok ? {} : (res.error.fieldErrors ?? {}));
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) => errors[k];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader title={t("payment")} />
        <CardBody className="grid gap-4">
          <Field label={t("iban")} error={err("payment.iban")}>
            <Input value={v.iban} onChange={set("iban")} dir="ltr" className="font-mono" maxLength={64} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("accountName")} error={err("payment.accountName")}>
              <Input value={v.accountName} onChange={set("accountName")} maxLength={120} />
            </Field>
            <Field label={t("bankName")} error={err("payment.bankName")}>
              <Input value={v.bankName} onChange={set("bankName")} maxLength={120} />
            </Field>
          </div>
          <Field label={t("instructionsEn")}>
            <Textarea value={v.instrEn} onChange={set("instrEn")} maxLength={2000} />
          </Field>
          <Field label={t("instructionsAr")}>
            <Textarea value={v.instrAr} onChange={set("instrAr")} dir="rtl" maxLength={2000} />
          </Field>
          <Field label={t("instructionsTr")}>
            <Textarea value={v.instrTr} onChange={set("instrTr")} maxLength={2000} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("contact")} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={t("whatsapp")} hint={t("whatsappHint")} error={err("contact.whatsapp")}>
            <Input value={v.whatsapp} onChange={set("whatsapp")} inputMode="numeric" dir="ltr" maxLength={20} />
          </Field>
          <Field label={t("email")} error={err("contact.email")}>
            <Input type="email" value={v.email} onChange={set("email")} dir="ltr" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("reminders")} />
        <CardBody>
          <Field label={t("reminderDays")} error={err("billing.reminderDaysBefore")} className="max-w-xs">
            <Input type="number" min={1} max={30} value={v.days} onChange={set("days")} />
          </Field>
        </CardBody>
      </Card>

      <div>
        <Button onClick={save} loading={busy}>
          {tc("save")}
        </Button>
      </div>
    </div>
  );
}
