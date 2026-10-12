import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { isDbConfigured } from "@mufasa/db";
import { StudentProgress } from "@/components/progress/student-progress";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import { canAccessStudent, requireRole } from "@/server/session";
import { displayNames } from "@/server/dal/tutoring";

export default async function TutorStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("hifz");
  if (!isDbConfigured()) return <PageHeader title={t("studentProfile")} />;

  const { id } = await params;
  const user = await requireRole("tutor", "admin");
  if (!(await canAccessStudent(user, id))) notFound();
  const name = (await displayNames([id])).get(id) ?? t("studentProfile");
  return (
    <>
      <PageHeader
        title={name}
        description={t("studentProfileSubtitle")}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/tutor/students">{t("backToStudents")}</Link>
          </Button>
        }
      />
      <StudentProgress actor={user} studentId={id} manage="staff" />
    </>
  );
}
