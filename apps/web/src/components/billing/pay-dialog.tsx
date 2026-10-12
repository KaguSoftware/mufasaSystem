"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { formatMoney, generateReferenceCode, whatsappLink } from "@/lib/billing-math";
import { quotePayment, submitPaymentRequest, uploadReceiptAction } from "@/server/actions/billing";
import { useAction } from "./use-action";
import type { BankInfo, LearnerOption, PlanView } from "./types";

type Quote = { amountMinor: number; discountMinor: number; priceMinor: number; currency: string; couponCode: string | null };

export function PayDialog({
  open,
  onOpenChange,
  plans,
  learners,
  bank,
  initialPlanId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plans: PlanView[];
  learners: LearnerOption[];
  bank: BankInfo;
  initialPlanId?: string | null;
}) {
  const t = useTranslations("billing.pay");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("title")} description={t("description")} size="lg">
        {open && (
          <PayForm plans={plans} learners={learners} bank={bank} initialPlanId={initialPlanId} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PayForm({
  plans,
  learners,
  bank,
  initialPlanId,
  onDone,
}: {
  plans: PlanView[];
  learners: LearnerOption[];
  bank: BankInfo;
  initialPlanId?: string | null;
  onDone: () => void;
}) {
  const t = useTranslations("billing.pay");
  const tc = useTranslations("common");
  const locale = useLocale();
  const run = useAction();

  const [reference] = useState(() => generateReferenceCode());
  const [planId, setPlanId] = useState<string | null>(initialPlanId ?? (plans.length === 1 ? plans[0]!.id : null));
  const [learnerIds, setLearnerIds] = useState<string[]>(learners.length === 1 ? [learners[0]!.id] : []);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState(false);
  const [rawQuote, setQuote] = useState<Quote | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [senderName, setSenderName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const plan = plans.find((p) => p.id === planId) ?? null;
  const quote = planId && learnerIds.length > 0 ? rawQuote : null;

  const pickPlan = (id: string | null) => {
    setPlanId(id);
    const seats = plans.find((p) => p.id === id)?.seats;
    if (seats) setLearnerIds((ids) => ids.slice(0, seats));
  };
  const pickLearners = (ids: string[]) => setLearnerIds(plan ? ids.slice(0, plan.seats) : ids);

  // The amount is always computed by the server.
  useEffect(() => {
    let cancelled = false;
    if (!planId || learnerIds.length === 0) return;
    quotePayment({ planId, learnerIds, couponCode: coupon ?? undefined }).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setQuote(res.data);
        setCouponError(false);
      } else {
        setQuote(null);
        if (res.error.fieldErrors?.couponCode) {
          setCouponError(true);
          setCoupon(null);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [planId, learnerIds, coupon]);

  const names = learners.filter((l) => learnerIds.includes(l.id)).map((l) => l.name);
  const namesKey = names.join("|");
  const waMessage = useMemo(
    () =>
      plan && quote
        ? t("whatsappMessage", {
            plan: plan.name,
            learners: namesKey.split("|").join(", "),
            amount: formatMoney(quote.amountMinor, quote.currency, locale),
            reference,
          })
        : "",
    [plan, quote, namesKey, reference, locale, t],
  );

  async function copyIban() {
    try {
      await navigator.clipboard.writeText(bank.iban.replace(/\s+/g, ""));
      setCopied(true);
      toast.success(t("copied"));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function submit() {
    if (!planId || !learnerIds.length) return;
    setBusy(true);
    try {
      let receiptPath: string | undefined;
      if (file) {
        const fd = new FormData();
        fd.set("file", file);
        const up = await run(() => uploadReceiptAction(fd), { refresh: false });
        if (!up.ok) return;
        receiptPath = up.data.path;
      }
      const res = await run(
        () =>
          submitPaymentRequest({
            planId,
            learnerIds,
            couponCode: coupon ?? undefined,
            reference,
            receiptPath,
            senderName: senderName || undefined,
            note: note || undefined,
          }),
        { success: t("sent") },
      );
      if (res.ok) onDone();
    } finally {
      setBusy(false);
    }
  }

  const planOptions = plans.map((p) => ({
    value: p.id,
    label: p.name,
    description: formatMoney(p.priceMinor, p.currency, locale),
  }));
  const learnerOptions = learners.map((l) => ({ value: l.id, label: l.name }));

  return (
    <div className="flex flex-col gap-5">
      <Field label={t("plan")} required>
        <Select options={planOptions} value={planId} onChange={pickPlan} placeholder={t("selectPlan")} />
      </Field>

      <Field label={t("learners")} required hint={plan && plan.seats > 1 ? t("seatsLimit", { count: plan.seats }) : undefined}>
        <Select multiple options={learnerOptions} value={learnerIds} onChange={pickLearners} placeholder={t("selectLearners")} />
      </Field>

      <Field label={t("coupon")} error={couponError ? t("couponInvalid") : undefined} hint={coupon ? t("couponApplied") : undefined}>
        <div className="flex gap-2">
          <Input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} aria-invalid={couponError || undefined} />
          <Button type="button" variant="secondary" disabled={!couponInput.trim()} onClick={() => setCoupon(couponInput.trim())}>
            {t("couponApply")}
          </Button>
        </div>
      </Field>

      {quote && plan && (
        <div className="rounded-lg border border-border bg-surface-2 p-4 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
            <dt className="text-muted">{t("price")}</dt>
            <dd className="text-end tabular-nums">{formatMoney(quote.priceMinor, quote.currency, locale)}</dd>
            {quote.discountMinor > 0 && (
              <>
                <dt className="text-muted">{t("discount")}</dt>
                <dd className="text-end tabular-nums text-success">-{formatMoney(quote.discountMinor, quote.currency, locale)}</dd>
              </>
            )}
            <dt className="font-medium">{t("total")}</dt>
            <dd className="text-end text-lg font-semibold tabular-nums">{formatMoney(quote.amountMinor, quote.currency, locale)}</dd>
            <dt className="text-muted">{t("reference")}</dt>
            <dd className="text-end font-mono font-semibold tracking-wide" dir="ltr">
              {reference}
            </dd>
          </dl>
          <p className="mt-2 text-xs text-muted">{t("referenceHint")}</p>
        </div>
      )}

      <div className="rounded-lg border border-border p-4 text-sm">
        <p className="mb-2 font-medium">{t("bankDetails")}</p>
        {bank.iban ? (
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-1.5">
            <dt className="text-muted">{t("iban")}</dt>
            <dd className="flex items-center justify-end gap-2 font-mono" dir="ltr">
              <span className="break-all">{bank.iban}</span>
              <Button type="button" variant="ghost" size="sm" onClick={copyIban} aria-label={t("copy")}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </dd>
            {bank.accountName && (
              <>
                <dt className="text-muted">{t("accountName")}</dt>
                <dd className="text-end">{bank.accountName}</dd>
              </>
            )}
            {bank.bankName && (
              <>
                <dt className="text-muted">{t("bankName")}</dt>
                <dd className="text-end">{bank.bankName}</dd>
              </>
            )}
          </dl>
        ) : (
          <p className="text-muted">{t("noBankDetails")}</p>
        )}
        {bank.instructions && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-1 font-medium">{t("howTo")}</p>
            <p className="whitespace-pre-line text-muted">{bank.instructions}</p>
          </div>
        )}
      </div>

      <Button asChild variant="secondary" className={!waMessage ? "pointer-events-none opacity-50" : undefined}>
        <a href={waMessage ? whatsappLink(bank.whatsapp, waMessage) : undefined} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="size-4" />
          {t("sendWhatsApp")}
        </a>
      </Button>

      <div>
        <p className="mb-1.5 text-sm font-medium">{t("receipt")}</p>
        <FileDropzone
          accept="application/pdf,image/jpeg,image/png,image/webp"
          maxSizeMb={10}
          value={file}
          onChange={setFile}
          label={t("receiptLabel")}
          hint={t("receiptHint")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("senderName")}>
          <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} maxLength={120} />
        </Field>
        <Field label={t("note")}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className="min-h-10" rows={1} />
        </Field>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">{tc("cancel")}</Button>
        </DialogClose>
        <Button onClick={submit} loading={busy} disabled={!quote || busy}>
          {t("submit")}
        </Button>
      </DialogFooter>
    </div>
  );
}
