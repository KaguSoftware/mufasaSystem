import { UsersRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { isDbConfigured } from "@mufasa/db";
import { StudentProgress } from "@/components/progress/student-progress";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import { parentChildOptions } from "@/server/dal/tutoring";
import { requireRole } from "@/server/session";
import { ChildPicker } from "../_components/child-picker";

export default async function ParentProgressPage({ searchParams }: { searchParams: Promise<{ child?: string; tab?: string }> }) {
  const t = await getTranslations("hifz");
  if (!isDbConfigured()) return <PageHeader title={t("progressTitle")} />;

  const [user, sp] = await Promise.all([requireRole("parent"), searchParams]);
  const children = await parentChildOptions(user);
  if (children.length === 0) {
    return (
      <>
        <PageHeader title={t("progressTitle")} />
        <EmptyState
          icon={<UsersRound className="size-8" />}
          title={t("noChildren")}
          description={t("noChildrenHint")}
          action={
            <Button asChild>
              <Link href="/parent/children">{t("addChild")}</Link>
            </Button>
          }
        />
      </>
    );
  }
  const selected = children.find((c) => c.id === sp.child) ?? children[0]!;
  const tab = (["courses", "hifz", "recitations", "homework", "attendance"] as const).find((x) => x === sp.tab);
  return (
    <>
      <PageHeader
        title={t("progressTitle")}
        description={t("progressSubtitle", { name: selected.name })}
        actions={<ChildPicker value={selected.id} options={children} />}
      />
      <StudentProgress key={selected.id} actor={user} studentId={selected.id} manage="parent" defaultTab={tab} />
    </>
  );
}
