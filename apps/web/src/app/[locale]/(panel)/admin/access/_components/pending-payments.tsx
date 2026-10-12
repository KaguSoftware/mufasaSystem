"use client";

import { Check, FileText, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useAction } from "@/components/billing/use-action";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatMoney } from "@/lib/billing-math";
import { approvePaymentAction, getReceiptUrlAction, rejectPaymentAction } from "@/server/actions/billing";
import type { PaymentRequestView } from "@/server/dal/billing";

export function PendingPayments({ rows }: { rows: PaymentRequestView[] }) {
  const t = useTranslations("access");
  const tc = useTranslations("common");
  const locale = useLocale();
  const run = useAction();
  const [approving, setApproving] = useState<PaymentRequestView | null>(null);
  const [rejecting, setRejecting] = useState<PaymentRequestView | null>(null);
  const [days, setDays] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function openReceipt(id: string) {
    const res = await run(() => getReceiptUrlAction({ id }), { refresh: false });
    if (res.ok) window.open(res.data.url, "_blank", "noopener,noreferrer");
  }

  async function approve() {
    if (!approving) return;
    setBusy(true);
    try {
      const res = await run(
        () =>
          approvePaymentAction({
            id: approving.id,
            periodDays: days ? Number(days) : undefined,
            note: note.trim() || undefined,
          }),
        { success: t("approvedToast") },
      );
      if (res.ok) setApproving(null);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!rejecting) return;
    setBusy(true);
    try {
      const res = await run(() => rejectPaymentAction({ id: rejecting.id, reason: reason.trim() }), { success: t("rejectedToast") });
      if (res.ok) setRejecting(null);
    } finally {
      setBusy(false);
    }
  }

  if (rows.length === 0) return <EmptyState title={t("pendingEmpty")} />;

  return (
    <>
      <Card>
        <Table>
          <THead>
            <Tr>
              <Th>{t("colPayer")}</Th>
              <Th>{t("colPlan")}</Th>
              <Th>{t("colLearners")}</Th>
              <Th>{t("colAmount")}</Th>
              <Th>{t("colReference")}</Th>
              <Th>{t("colReceipt")}</Th>
              <Th>{t("colCreated")}</Th>
              <Th />
            </Tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td>
                  <p className="font-medium">{r.payer.name}</p>
                  <p className="text-xs text-muted" dir="ltr">
                    {r.payer.email}
                  </p>
                  {r.senderName && <p className="text-xs text-muted">{t("senderName", { name: r.senderName })}</p>}
                </Td>
                <Td>{r.plan.name}</Td>
                <Td>{r.learners.map((l) => l.name).join(", ")}</Td>
                <Td className="tabular-nums">
                  {formatMoney(r.amountMinor, r.currency, locale)}
                  {r.couponCode && <p className="text-xs text-muted">{r.couponCode}</p>}
                </Td>
                <Td className="font-mono text-xs" dir="ltr">
                  {r.reference ?? tc("none")}
                </Td>
                <Td>
                  {r.hasReceipt ? (
                    <Button variant="ghost" size="sm" onClick={() => openReceipt(r.id)}>
                      <FileText className="size-4" />
                      {t("viewReceipt")}
                    </Button>
                  ) : (
                    <span className="text-muted">{t("noReceipt")}</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-muted">{new Date(r.createdAt).toLocaleString(locale)}</Td>
                <Td className="whitespace-nowrap text-end">
                  <Button
                    size="sm"
                    onClick={() => {
                      setDays("");
                      setNote("");
                      setApproving(r);
                    }}
                  >
                    <Check className="size-4" />
                    {t("approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ms-2"
                    onClick={() => {
                      setReason("");
                      setRejecting(r);
                    }}
                  >
                    <X className="size-4" />
                    {t("reject")}
                  </Button>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Card>

      <Dialog open={approving !== null} onOpenChange={(v) => !v && setApproving(null)}>
        <DialogContent title={t("approveTitle")} description={t("approveDescription")}>
          {approving && (
            <div className="flex flex-col gap-4">
              <p className="text-sm">
                {approving.payer.name} · {approving.plan.name} · {formatMoney(approving.amountMinor, approving.currency, locale)}
              </p>
              <Field label={t("periodDays")} hint={t("periodHint", { days: approving.plan.periodDays })}>
                <Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} />
              </Field>
              <Field label={t("reviewNote")}>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
              </Field>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">{tc("cancel")}</Button>
                </DialogClose>
                <Button onClick={approve} loading={busy}>
                  {t("approve")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rejecting !== null} onOpenChange={(v) => !v && setRejecting(null)}>
        <DialogContent title={t("rejectTitle")} description={t("rejectDescription")}>
          <div className="flex flex-col gap-4">
            <Field label={t("rejectReason")} required>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
            </Field>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">{tc("cancel")}</Button>
              </DialogClose>
              <Button variant="danger" onClick={reject} loading={busy} disabled={reason.trim().length < 2}>
                {t("reject")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
