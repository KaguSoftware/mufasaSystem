import type { Metadata } from "next";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { t18n } from "@mufasa/config/locales";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";
import { ageLabel } from "@/components/site/cards";
import { Container, PageHero } from "@/components/site/section";
import { pageMetadata } from "@/components/site/seo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { whatsappLink } from "@/lib/billing-math";
import { getCourseBySlug, listPublishedCourses } from "@/server/dal/catalog";
import { getSiteContact, safePublic } from "@/server/dal/public";

export const revalidate = 300;

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateStaticParams() {
  const courses = await safePublic(() => listPublishedCourses(), []);
  return courses.map((c) => ({ slug: c.slug }));
}

/** Public view: no viewer is passed, so drafts are never returned. */
const load = (slug: string) => safePublic(() => getCourseBySlug(slug), null);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: l, slug } = await params;
  const locale = asLocale(l);
  const course = await load(slug);
  if (!course) return {};
  const t = await getTranslations({ locale, namespace: "public.programs" });
  return pageMetadata({
    locale,
    path: `/courses/${slug}`,
    title: t18n(course.title, locale),
    description: t18n(course.description, locale) || t("metaDescription"),
  });
}

export default async function CoursePage({ params }: Props) {
  const { locale: l, slug } = await params;
  const locale = asLocale(l);
  setRequestLocale(locale);
  const course = await load(slug);
  if (!course) notFound();
  const t = await getTranslations("public.course");
  const tp = await getTranslations("public.programDetail");
  const contact = await getSiteContact();

  const title = t18n(course.title, locale);
  const ages = await ageLabel(course.ageMin, course.ageMax);
  const units = course.units.filter((u) => u.lessons.length > 0);
  const lessonTotal = units.reduce((n, u) => n + u.lessons.length, 0);

  return (
    <>
      <PageHero title={title} subtitle={t18n(course.description, locale) || undefined}>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Badge tone="primary">{t(`levels.${course.level}`)}</Badge>
          {course.isFree && <Badge tone="success">{t("free")}</Badge>}
          {ages && <Badge>{ages}</Badge>}
        </div>
        <Link
          href={`/programs/${course.program.slug}`}
          className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {tp("back")}: {t18n(course.program.name, locale)}
        </Link>
      </PageHero>

      <Container className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[1fr_20rem]">
        <div>
          <h2 className="text-2xl font-semibold">{t("syllabus")}</h2>
          {units.length > 0 && (
            <p className="mt-1 text-sm text-muted">
              {t("unitCount", { count: units.length })} / {t("lessonCount", { count: lessonTotal })}
            </p>
          )}
          {units.length === 0 ? (
            <p className="mt-4 text-muted">{t("noSyllabus")}</p>
          ) : (
            <ol className="mt-6 space-y-4">
              {units.map((u) => (
                <li key={u.id}>
                  <Card>
                    <CardBody>
                      <h3 className="font-semibold">{t18n(u.title, locale)}</h3>
                      {t18n(u.description, locale) && (
                        <p className="mt-1 text-sm text-muted">{t18n(u.description, locale)}</p>
                      )}
                      <ul className="mt-4 divide-y divide-border">
                        {u.lessons.map((lesson) => (
                          <li key={lesson.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                            <span>{t18n(lesson.title, locale)}</span>
                            <span className="flex items-center gap-2">
                              {lesson.isPreview && <Badge tone="accent">{t("preview")}</Badge>}
                              <Badge>{t(`lessonTypes.${lesson.type}`)}</Badge>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CardBody>
                  </Card>
                </li>
              ))}
            </ol>
          )}
        </div>

        <aside>
          <Card className="sticky top-24">
            <CardBody className="space-y-4">
              <h2 className="text-lg font-semibold">{t("ctaTitle")}</h2>
              <p className="text-sm text-muted">{course.isFree ? t("ctaFree") : t("ctaPaid")}</p>
              <Button asChild size="lg" className="w-full">
                <Link href="/sign-up">{t("signUp")}</Link>
              </Button>
              {!course.isFree && (
                <Button asChild size="lg" variant="outline" className="w-full">
                  <Link href="/pricing">{t("viewPricing")}</Link>
                </Button>
              )}
              <Button asChild variant="ghost" className="w-full">
                <a
                  href={whatsappLink(contact.whatsapp, t("whatsappMessage", { title }))}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="size-4" aria-hidden />
                  {t("whatsapp")}
                </a>
              </Button>
            </CardBody>
          </Card>
        </aside>
      </Container>
    </>
  );
}
