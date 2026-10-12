import { Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { isDbConfigured } from "@mufasa/db";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { listTutorStudents } from "@/server/dal/tutoring";
import { requireRole } from "@/server/session";

export default async function TutorStudentsPage() {
  const t = await getTranslations("hifz");
  if (!isDbConfigured()) return <PageHeader title={t("studentsTitle")} />;

  const user = await requireRole("tutor", "admin");
  const students = await listTutorStudents(user);
  return (
    <>
      <PageHeader title={t("studentsTitle")} description={t("studentsSubtitle")} />
      {students.length === 0 ? (
        <EmptyState icon={<Users className="size-8" />} title={t("noStudents")} description={t("noStudentsHint")} />
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <THead>
              <Tr>
                <Th>{t("student")}</Th>
                <Th>{t("memorizedAyahs")}</Th>
                <Th>{t("coursesCount")}</Th>
                <Th>{t("pendingReviews")}</Th>
                <Th>{t("openHomework")}</Th>
              </Tr>
            </THead>
            <TBody>
              {students.map((s) => (
                <Tr key={s.id}>
                  <Td>
                    <Link href={`/tutor/students/${s.id}`} className="font-medium hover:underline">
                      {s.name}
                    </Link>
                  </Td>
                  <Td className="tabular-nums">{s.memorizedAyahs}</Td>
                  <Td className="tabular-nums">{s.courses}</Td>
                  <Td>{s.pendingReviews > 0 ? <Badge tone="warning">{s.pendingReviews}</Badge> : <span className="text-muted">0</span>}</Td>
                  <Td>{s.openHomework > 0 ? <Badge tone="primary">{s.openHomework}</Badge> : <span className="text-muted">0</span>}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
