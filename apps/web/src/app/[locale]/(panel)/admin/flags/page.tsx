import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { pageUser } from "@/components/account/page-user";
import { listFlags } from "@/server/dal/flags-admin";
import { FlagsList } from "./_components/flags-list";

export default async function AdminFlagsPage() {
  const [t, user] = await Promise.all([getTranslations("admin"), pageUser()]);
  if (!user || user.role !== "admin") return <PageHeader title={t("flagsTitle")} />;
  const flags = await listFlags(user);
  return (
    <>
      <PageHeader title={t("flagsTitle")} description={t("flagsSubtitle")} />
      <FlagsList flags={flags} />
    </>
  );
}
