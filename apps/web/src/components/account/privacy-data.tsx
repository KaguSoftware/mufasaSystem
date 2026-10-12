"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { requestData } from "@/server/actions/data-requests";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { useErrorText } from "./use-action-error";

export type PrivacySubject = { id: string; name: string; isSelf: boolean };
export type PrivacyRequest = {
  id: string;
  subjectName: string;
  type: "export" | "delete";
  status: "pending" | "approved" | "rejected" | "completed";
  createdAt: string;
};

const TONE = { pending: "warning", approved: "primary", rejected: "danger", completed: "success" } as const;

/** Export / deletion requests for yourself, and for your children when you are a parent. */
export function PrivacyData({
  subjects,
  requests,
  canDelete,
}: {
  subjects: PrivacySubject[];
  requests: PrivacyRequest[];
  canDelete: boolean;
}) {
  const t = useTranslations("account");
  const locale = useLocale();
  const errText = useErrorText();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function send(subjectUserId: string, type: "export" | "delete") {
    setBusy(`${subjectUserId}:${type}`);
    const res = await requestData({ subjectUserId, type });
    setBusy(null);
    if (!res.ok) {
      if (res.error.code === "conflict") return toast.error(t("requestAlreadyPending"));
      return toast.error(errText(res.error));
    }
    toast.success(type === "export" ? t("exportRequested") : t("deleteRequested"));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">{t("privacyIntro")}</p>
      <div className="flex flex-col gap-3">
        {subjects.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4">
            <span className="font-medium">{s.isSelf ? t("myData") : t("childData", { name: s.name })}</span>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" loading={busy === `${s.id}:export`} onClick={() => send(s.id, "export")}>
                {t("requestExport")}
              </Button>
              {canDelete && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="danger" size="sm">
                      {t("requestDelete")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent title={t("deleteConfirmTitle")} description={t("deleteConfirmBody")} size="sm">
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">{t("cancel")}</Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button variant="danger" onClick={() => send(s.id, "delete")}>
                          {t("requestDelete")}
                        </Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        ))}
      </div>

      {requests.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium">{t("yourRequests")}</h4>
          <ul className="divide-y divide-border rounded-md border border-border text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span>
                  {r.type === "export" ? t("typeExport") : t("typeDelete")} · {r.subjectName}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-muted">{new Date(r.createdAt).toLocaleDateString(locale)}</span>
                  <Badge tone={TONE[r.status]}>{t(`status_${r.status}`)}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
