import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";

export default async function AdminHome() {
  const t = await getTranslations("panel.admin");
  return <PageHeader title={t("dashboard")} />;
}
