import { getTranslations } from "next-intl/server";
import { isDbConfigured } from "@mufasa/db";
import { PageHeader } from "@/components/ui/misc";
import { getSettings } from "@/server/dal/settings";
import { requireRole } from "@/server/session";
import { SettingsForm } from "./_components/settings-form";

export default async function AdminSettingsPage() {
  const t = await getTranslations("billing.settings");
  if (!isDbConfigured()) return <PageHeader title={t("title")} />;
  await requireRole("admin");
  const s = await getSettings();
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <SettingsForm initial={s} />
    </>
  );
}
