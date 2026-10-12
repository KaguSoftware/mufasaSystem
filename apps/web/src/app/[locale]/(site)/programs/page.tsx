import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale } from "@/i18n/routing";
import { ProgramCard } from "@/components/site/cards";
import { Container, PageHero } from "@/components/site/section";
import { pageMetadata } from "@/components/site/seo";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { whatsappLink } from "@/lib/billing-math";
import { listPublishedCourses, listPublishedPrograms } from "@/server/dal/catalog";
import { getSiteContact, safePublic } from "@/server/dal/public";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "public.programs" });
  return pageMetadata({ locale, path: "/programs", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function ProgramsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(asLocale(locale));
  const t = await getTranslations("public.programs");
  const tp = await getTranslations("public.pricing");
  const [programs, courses, contact] = await Promise.all([
    safePublic(listPublishedPrograms, []),
    safePublic(() => listPublishedCourses(), []),
    getSiteContact(),
  ]);
  const counts = new Map<string, number>();
  for (const c of courses) counts.set(c.programId, (counts.get(c.programId) ?? 0) + 1);

  return (
    <>
      <PageHero title={t("title")} subtitle={t("subtitle")} />
      <Container className="py-12 sm:py-16">
        {programs.length === 0 ? (
          <EmptyState
            title={t("emptyTitle")}
            description={t("emptyBody")}
            action={
              <Button asChild>
                <a href={whatsappLink(contact.whatsapp, tp("whatsappMessage"))} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" aria-hidden />
                  {tp("whatsappCta")}
                </a>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((p) => (
              <ProgramCard key={p.id} program={p} courseCount={counts.get(p.id) ?? 0} />
            ))}
          </div>
        )}
      </Container>
    </>
  );
}
