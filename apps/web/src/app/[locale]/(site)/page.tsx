import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale } from "@/i18n/routing";
import { Features } from "@/components/site/features";
import { Hero } from "@/components/site/hero";
import { HowItWorks } from "@/components/site/how-it-works";
import { FaqTeaser, FinalCta, PricingTeaser, ProgramsPreview, Testimonials } from "@/components/site/landing-sections";
import { pageMetadata } from "@/components/site/seo";
import { listPublishedPrograms } from "@/server/dal/catalog";
import { getSiteContact, safePublic } from "@/server/dal/public";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "public.hero" });
  return pageMetadata({ locale, path: "", description: t("subtitle") });
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(asLocale(locale));
  const [programs, contact] = await Promise.all([safePublic(listPublishedPrograms, []), getSiteContact()]);
  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <ProgramsPreview programs={programs} />
      <PricingTeaser />
      <Testimonials />
      <FaqTeaser />
      <FinalCta whatsapp={contact.whatsapp} />
    </>
  );
}
