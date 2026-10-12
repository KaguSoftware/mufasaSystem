import { getTranslations } from "next-intl/server";
import { isDbConfigured } from "@mufasa/db";
import { PageHeader } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/server/session";
import { getCourseForEditor, listPrograms } from "@/server/dal/catalog";
import { CourseEditor } from "./_components/course-editor";

export default async function AdminCourseEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("catalog");
  if (!isDbConfigured()) return <PageHeader title={t("editCourse")} />;
  const { id } = await params;
  const user = await requireRole("admin");
  const [course, programs] = await Promise.all([getCourseForEditor(user, id), listPrograms(user)]);
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/courses" className="text-primary hover:underline">
          {t("backToCourses")}
        </Link>
      </p>
      <CourseEditor course={course} programs={programs.map((p) => ({ id: p.id, name: p.name }))} />
    </>
  );
}
