import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale } from "@/i18n/routing";
import { LegalPage } from "@/components/site/legal-page";
import { pageMetadata } from "@/components/site/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "legal.kvkk" });
  return pageMetadata({ locale, path: "/legal/kvkk", title: t("metaTitle"), description: t("intro") });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(asLocale(locale));
  return <LegalPage doc="kvkk" />;
}
