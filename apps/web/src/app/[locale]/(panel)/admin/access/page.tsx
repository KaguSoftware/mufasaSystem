import { getTranslations } from "next-intl/server";
import { isDbConfigured } from "@mufasa/db";
import { PageHeader } from "@/components/ui/misc";
import { accessTargets } from "@/server/dal/access-admin";
import { listPaymentRequests } from "@/server/dal/billing";
import { requireRole } from "@/server/session";
import { AccessTabs } from "./_components/access-tabs";

export default async function AdminAccessPage() {
  const t = await getTranslations("access");
  if (!isDbConfigured()) return <PageHeader title={t("title")} />;
  const user = await requireRole("admin");
  const [pending, targets] = await Promise.all([listPaymentRequests(user, "pending"), accessTargets(user)]);
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <AccessTabs pending={pending} targets={targets} />
    </>
  );
}
