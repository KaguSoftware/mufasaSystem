"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useErrorText } from "@/components/account/use-action-error";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { createConversation } from "@/server/actions/studio";

export function NewConversationButton({ base }: { base: string }) {
  const t = useTranslations("studio");
  const errText = useErrorText();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const res = await createConversation({ locale: "ar" });
    if (!res.ok) {
      setBusy(false);
      return toast.error(errText(res.error));
    }
    router.push(`${base}/${res.data.id}`);
  }

  return (
    <Button onClick={create} loading={busy}>
      <Plus className="size-4" />
      {busy ? t("creating") : t("newConversation")}
    </Button>
  );
}
