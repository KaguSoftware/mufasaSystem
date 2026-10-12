"use client";

import { useTranslations } from "next-intl";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "@/components/ui/controls";
import type { PaymentRequestView } from "@/server/dal/billing";
import { GiveAccess } from "./give-access";
import { PendingPayments } from "./pending-payments";

export type Targets = {
  programs: { id: string; name: string }[];
  courses: { id: string; name: string; programId: string }[];
};

export function AccessTabs({ pending, targets }: { pending: PaymentRequestView[]; targets: Targets }) {
  const t = useTranslations("access");
  return (
    <TabsRoot defaultValue={pending.length ? "pending" : "give"}>
      <TabsList>
        <TabsTrigger value="pending">
          {t("tabPending")}
          {pending.length > 0 && <span className="ms-2 rounded-full bg-primary px-2 text-xs text-primary-fg">{pending.length}</span>}
        </TabsTrigger>
        <TabsTrigger value="give">{t("tabGive")}</TabsTrigger>
      </TabsList>
      <TabsContent value="pending">
        <PendingPayments rows={pending} />
      </TabsContent>
      <TabsContent value="give">
        <GiveAccess targets={targets} />
      </TabsContent>
    </TabsRoot>
  );
}
