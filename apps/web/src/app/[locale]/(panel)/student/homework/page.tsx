import { getTranslations } from "next-intl/server";
import { isDbConfigured } from "@mufasa/db";
import { HomeworkList } from "@/components/homework/homework-list";
import { PageHeader } from "@/components/ui/misc";
import { studentHomework } from "@/server/dal/homework";
import { requireUser } from "@/server/session";

export default async function StudentHomeworkPage() {
  const t = await getTranslations("homework");
  if (!isDbConfigured()) return <PageHeader title={t("title")} />;

  const user = await requireUser();
  const items = await studentHomework(user, user.id);
  const open = items.filter((i) => i.state === "open" || i.state === "overdue" || i.state === "returned");
  const done = items.filter((i) => !open.includes(i));
  return (
    <>
      <PageHeader title={t("title")} description={t("studentSubtitle")} />
      <div className="flex flex-col gap-8">
        <HomeworkList items={open} studentId={user.id} interactive />
        {done.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{t("completed")}</h2>
            <HomeworkList items={done} studentId={user.id} interactive={false} />
          </section>
        )}
      </div>
    </>
  );
}
