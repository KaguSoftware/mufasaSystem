"use client";

import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRunAction } from "@/components/catalog/use-run-action";
import { Button } from "@/components/ui/button";
import { requestAiFeedbackAction } from "@/server/actions/recitations";

export function RetryAiButton({ recitationId }: { recitationId: string }) {
  const t = useTranslations("recitation");
  const run = useRunAction();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      className="self-start"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        await run(() => requestAiFeedbackAction({ recitationId }), { success: t("aiRequeued") });
        setBusy(false);
      }}
    >
      <RefreshCw className="size-4" />
      {t("aiRetry")}
    </Button>
  );
}
