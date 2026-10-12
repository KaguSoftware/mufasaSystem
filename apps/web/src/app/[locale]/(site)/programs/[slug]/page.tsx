import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { t18n } from "@mufasa/config/locales";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";
import { CourseCard } from "@/components/site/cards";
import { Container, PageHero } from "@/components/site/section";
import { pageMetadata } from "@/components/site/seo";
import { EmptyState } from "@/components/ui/misc";
import { listPublishedCourses, listPublishedPrograms } from "@/server/dal/catalog";
import { safePublic } from "@/server/dal/public";

export const revalidate = 300;

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateStaticParams() {
  const programs = await safePublic(listPublishedPrograms, []);
  return programs.map((p) => ({ slug: p.slug }));
}

async function load(slug: string) {
  const programs = await safePublic(listPublishedPrograms, []);
  const program = programs.find((p) => p.slug === slug);
  if (!program) return null;
  const courses = await safePublic(() => listPublishedCourses(slug), []);
  return { program, courses };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: l, slug } = await params;
  const locale = asLocale(l);
  const data = await load(slug);
  if (!data) return {};
  const t = await getTranslations({ locale, namespace: "public.programs" });
  return pageMetadata({
    locale,
    path: `/programs/${slug}`,
    title: t18n(data.program.name, locale),
    description: t18n(data.program.description, locale) || t("metaDescription"),
  });
}

export default async function ProgramPage({ params }: Props) {
  const { locale: l, slug } = await params;
  const locale = asLocale(l);
  setRequestLocale(locale);
  const data = await load(slug);
  if (!data) notFound();
  const t = await getTranslations("public.programDetail");
  const { program, courses } = data;

  return (
    <>
      <PageHero title={t18n(program.name, locale)} subtitle={t18n(program.description, locale) || undefined}>
        <Link href="/programs" className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {t("back")}
        </Link>
      </PageHero>
      <Container className="py-12 sm:py-16">
        <h2 className="mb-6 text-2xl font-semibold">{t("coursesTitle")}</h2>
        {courses.length === 0 ? (
          <EmptyState title={t("noCourses")} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        )}
      </Container>
    </>
  );
}
