"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { getCertificateDownload } from "@/server/actions/certificates";
import { useErrorText } from "@/components/account/use-action-error";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

export function DownloadButton({ id, ready }: { id: string; ready: boolean }) {
  const t = useTranslations("certificates");
  const errText = useErrorText();
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    const res = await getCertificateDownload({ id });
    setBusy(false);
    if (!res.ok) return toast.error(errText(res.error));
    if (res.data.status === "pending") return toast.info(t("pendingHint"));
    window.open(res.data.url, "_blank", "noopener,noreferrer");
  }

  return (
    <Button variant="outline" size="sm" onClick={open} loading={busy} disabled={!ready}>
      <Download className="size-4" />
      {ready ? t("download") : t("pending")}
    </Button>
  );
}
