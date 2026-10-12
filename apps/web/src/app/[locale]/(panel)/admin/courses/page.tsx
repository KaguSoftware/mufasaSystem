import { getTranslations } from "next-intl/server";
import { isDbConfigured } from "@mufasa/db";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/server/session";
import { listCourses, listPrograms } from "@/server/dal/catalog";
import { CoursesManager } from "./_components/courses-manager";

export default async function AdminCoursesPage({ searchParams }: { searchParams: Promise<{ program?: string }> }) {
  const t = await getTranslations("catalog");
  if (!isDbConfigured()) return <PageHeader title={t("coursesTitle")} />;
  const user = await requireRole("admin");
  const { program } = await searchParams;
  const [programs, courses] = await Promise.all([listPrograms(user), listCourses(user, { programId: program })]);
  return (
    <>
      <PageHeader title={t("coursesTitle")} description={t("coursesDescription")} />
      <CoursesManager
        courses={courses}
        programs={programs.map((p) => ({ id: p.id, name: p.name }))}
        activeProgramId={program ?? null}
      />
    </>
  );
}
