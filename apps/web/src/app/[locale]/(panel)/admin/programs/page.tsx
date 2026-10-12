import { getTranslations } from "next-intl/server";
import { isDbConfigured } from "@mufasa/db";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/server/session";
import { listPrograms } from "@/server/dal/catalog";
import { ProgramsManager } from "./_components/programs-manager";

export default async function AdminProgramsPage() {
  const t = await getTranslations("catalog");
  if (!isDbConfigured()) return <PageHeader title={t("programsTitle")} />;
  const user = await requireRole("admin");
  const programs = await listPrograms(user);
  return (
    <>
      <PageHeader title={t("programsTitle")} description={t("programsDescription")} />
      <ProgramsManager programs={programs} />
    </>
  );
}
