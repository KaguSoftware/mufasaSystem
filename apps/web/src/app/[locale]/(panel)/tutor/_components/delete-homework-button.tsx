"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRunAction } from "@/components/catalog/use-run-action";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { deleteHomeworkAction } from "@/server/actions/homework";

export function DeleteHomeworkButton({ homeworkId }: { homeworkId: string }) {
  const t = useTranslations("homework");
  const run = useRunAction();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="danger"
      onClick={async () => {
        if (!window.confirm(t("confirmDelete"))) return;
        const res = await run(() => deleteHomeworkAction({ homeworkId }), { success: t("deleted"), refresh: false });
        if (res.ok) router.push("/tutor/homework");
      }}
    >
      <Trash2 className="size-4" />
      {t("delete")}
    </Button>
  );
}
