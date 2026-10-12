import { getFormatter, getTranslations } from "next-intl/server";
import { isDbConfigured } from "@mufasa/db";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { homeworkTargetOptions, listTutorHomework } from "@/server/dal/homework";
import { listSurahs, listTutorStudents } from "@/server/dal/tutoring";
import { requireRole } from "@/server/session";
import { CreateHomeworkDialog } from "../_components/homework-create";

export default async function TutorHomeworkPage() {
  const t = await getTranslations("homework");
  if (!isDbConfigured()) return <PageHeader title={t("title")} />;

  const user = await requireRole("tutor", "admin");
  const format = await getFormatter();
  const [rows, targets, students, surahs] = await Promise.all([
    listTutorHomework(user),
    homeworkTargetOptions(user),
    listTutorStudents(user),
    listSurahs(),
  ]);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("tutorSubtitle")}
        actions={<CreateHomeworkDialog options={{ ...targets, students: students.map((s) => ({ id: s.id, name: s.name })), surahs }} />}
      />
      {rows.length === 0 ? (
        <EmptyState title={t("noHomework")} description={t("noHomeworkTutorHint")} />
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <THead>
              <Tr>
                <Th>{t("titleLabel")}</Th>
                <Th>{t("assignedTo")}</Th>
                <Th>{t("targetType")}</Th>
                <Th>{t("dueAt")}</Th>
                <Th>{t("submissions")}</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <Link href={`/tutor/homework/${r.id}`} className="font-medium hover:underline">
                      {r.title}
                    </Link>
                  </Td>
                  <Td>{r.groupName ?? r.studentName ?? "-"}</Td>
                  <Td>{t(`target_${r.targetType}`)}</Td>
                  <Td className="whitespace-nowrap">{format.dateTime(r.dueAt, { dateStyle: "medium", timeStyle: "short" })}</Td>
                  <Td>
                    <span className="tabular-nums">{t("submittedOf", { submitted: r.submitted, total: r.recipients })}</span>{" "}
                    {r.toReview > 0 && <Badge tone="warning">{t("toReview", { count: r.toReview })}</Badge>}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
