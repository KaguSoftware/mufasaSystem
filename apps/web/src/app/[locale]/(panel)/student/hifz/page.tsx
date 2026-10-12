import { getTranslations } from "next-intl/server";
import { isDbConfigured } from "@mufasa/db";
import { HifzOverviewView } from "@/components/hifz/hifz-overview";
import { PageHeader } from "@/components/ui/misc";
import { hifzOverview } from "@/server/dal/hifz";
import { listSurahs } from "@/server/dal/tutoring";
import { requireUser } from "@/server/session";

export default async function StudentHifzPage() {
  const t = await getTranslations("hifz");
  if (!isDbConfigured()) return <PageHeader title={t("title")} />;

  const user = await requireUser();
  const [overview, surahs] = await Promise.all([hifzOverview(user, user.id), listSurahs()]);
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <HifzOverviewView overview={overview} surahs={surahs} manage={null} />
    </>
  );
}
