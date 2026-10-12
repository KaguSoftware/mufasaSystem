"use client";

import { Award, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { t18n, type I18nText } from "@mufasa/config/locales";
import { usePathname, useRouter } from "@/i18n/navigation";
import { issueManualCertificate, revokeCertificate } from "@/server/actions/certificates";
import { useErrorText } from "@/components/account/use-action-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";

type Row = {
  id: string;
  code: string;
  title: I18nText;
  recipientName: string;
  userName: string;
  userEmail: string;
  issuedAt: string;
  revokedAt: string | null;
  pdfReady: boolean;
};

export function CertificatesPanel({
  rows,
  q,
  page,
  total,
  pageSize,
}: {
  rows: Row[];
  q: string;
  page: number;
  total: number;
  pageSize: number;
}) {
  const t = useTranslations("certificates");
  const tAdmin = useTranslations("admin");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(q);
  const [issueOpen, setIssueOpen] = useState(false);
  const [revoking, setRevoking] = useState<Row | null>(null);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function go(params: { q?: string; page?: number }) {
    const sp = new URLSearchParams();
    const nextQ = params.q ?? q;
    if (nextQ) sp.set("q", nextQ);
    if (params.page && params.page > 1) sp.set("page", String(params.page));
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: search.trim() });
          }}
        >
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="w-72" />
          <Button type="submit" variant="outline">
            {t("search")}
          </Button>
        </form>
        <Button onClick={() => setIssueOpen(true)}>
          <Plus className="size-4" />
          {t("issue")}
        </Button>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState className="border-0" icon={<Award className="size-8" />} title={t("noCertificates")} />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>{t("colRecipient")}</Th>
                <Th>{t("colCertificate")}</Th>
                <Th>{t("colCode")}</Th>
                <Th>{t("colIssued")}</Th>
                <Th>{t("colStatus")}</Th>
                <Th className="w-24" />
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <p className="font-medium">{r.recipientName}</p>
                    <p className="text-xs text-muted">{r.userEmail || r.userName}</p>
                  </Td>
                  <Td>{t18n(r.title, locale)}</Td>
                  <Td>
                    <code className="text-xs" dir="ltr">
                      {r.code}
                    </code>
                  </Td>
                  <Td className="whitespace-nowrap text-muted">{new Date(r.issuedAt).toLocaleDateString(locale)}</Td>
                  <Td>
                    {r.revokedAt ? (
                      <Badge tone="danger">{t("revoked")}</Badge>
                    ) : r.pdfReady ? (
                      <Badge tone="success">{t("valid")}</Badge>
                    ) : (
                      <Badge tone="warning">{t("pending")}</Badge>
                    )}
                  </Td>
                  <Td>
                    {!r.revokedAt && (
                      <Button variant="ghost" size="sm" onClick={() => setRevoking(r)}>
                        {t("revoke")}
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => go({ page: page - 1 })}>
            {tAdmin("previous")}
          </Button>
          <span className="text-muted">
            {page} / {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => go({ page: page + 1 })}>
            {tAdmin("next")}
          </Button>
        </div>
      )}

      <IssueDialog open={issueOpen} onOpenChange={setIssueOpen} onDone={() => router.refresh()} />
      <RevokeDialog row={revoking} onClose={() => setRevoking(null)} onDone={() => router.refresh()} />
    </div>
  );
}

function IssueDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const t = useTranslations("certificates");
  const tAdmin = useTranslations("admin");
  const errText = useErrorText();
  const [userRef, setUserRef] = useState("");
  const [en, setEn] = useState("");
  const [ar, setAr] = useState("");
  const [tr, setTr] = useState("");
  const [busy, setBusy] = useState(false);
  const [userError, setUserError] = useState<string | undefined>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setUserError(undefined);
    const res = await issueManualCertificate({
      userRef,
      title: { en, ar: ar || undefined, tr: tr || undefined },
    });
    setBusy(false);
    if (!res.ok) {
      if (res.error.fieldErrors?.userRef) setUserError(t("userNotFound"));
      return toast.error(errText(res.error));
    }
    toast.success(res.data.created ? t("issued") : t("alreadyIssued"));
    setUserRef("");
    setEn("");
    setAr("");
    setTr("");
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("issueTitle")} description={t("issueDescription")}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label={t("userRef")} hint={t("userRefHint")} error={userError} required>
            <Input value={userRef} onChange={(e) => setUserRef(e.target.value)} autoComplete="off" dir="ltr" />
          </Field>
          <Field label={t("titleEn")} required>
            <Input value={en} onChange={(e) => setEn(e.target.value)} maxLength={200} />
          </Field>
          <Field label={t("titleAr")}>
            <Input value={ar} onChange={(e) => setAr(e.target.value)} maxLength={200} dir="rtl" />
          </Field>
          <Field label={t("titleTr")}>
            <Input value={tr} onChange={(e) => setTr(e.target.value)} maxLength={200} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tAdmin("cancel")}
            </Button>
            <Button type="submit" loading={busy} disabled={!userRef.trim() || !en.trim()}>
              {t("issueSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RevokeDialog({ row, onClose, onDone }: { row: Row | null; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("certificates");
  const tAdmin = useTranslations("admin");
  const errText = useErrorText();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!row) return;
    setBusy(true);
    const res = await revokeCertificate({ id: row.id, reason });
    setBusy(false);
    if (!res.ok) return toast.error(errText(res.error));
    toast.success(t("revokedDone"));
    setReason("");
    onClose();
    onDone();
  }

  return (
    <Dialog open={Boolean(row)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={t("revokeTitle")} description={t("revokeDescription")} size="sm">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label={t("revokeReason")} required>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tAdmin("cancel")}
            </Button>
            <Button type="submit" variant="danger" loading={busy} disabled={reason.trim().length < 3}>
              {t("revokeSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
