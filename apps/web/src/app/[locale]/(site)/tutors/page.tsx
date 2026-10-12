import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale } from "@/i18n/routing";
import { Container, PageHero } from "@/components/site/section";
import { pageMetadata } from "@/components/site/seo";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { listPublicTutors } from "@/server/dal/public";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "public.tutors" });
  return pageMetadata({ locale, path: "/tutors", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function TutorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(asLocale(locale));
  const t = await getTranslations("public.tutors");
  const tutors = await listPublicTutors();

  return (
    <>
      <PageHero title={t("title")} subtitle={t("subtitle")} />
      <Container className="py-12 sm:py-16">
        {tutors.length === 0 ? (
          <EmptyState title={t("emptyTitle")} description={t("emptyBody")} />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {tutors.map((tutor) => (
              <Card key={tutor.userId}>
                <CardBody className="flex gap-4">
                  <Avatar name={tutor.displayName} size={56} />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold">{tutor.displayName}</h2>
                    {tutor.headline && <p className="text-sm text-primary">{tutor.headline}</p>}
                    {tutor.bio && <p className="mt-3 text-pretty text-muted">{tutor.bio}</p>}
                    {tutor.languages.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-medium text-muted">{t("languages")}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {tutor.languages.map((l) => (
                            <Badge key={l}>{l}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {tutor.specialties.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-muted">{t("specialties")}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {tutor.specialties.map((s) => (
                            <Badge key={s} tone="primary">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
        <p className="mt-10 flex items-start gap-2 text-sm text-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          {t("safety")}
        </p>
      </Container>
    </>
  );
}
