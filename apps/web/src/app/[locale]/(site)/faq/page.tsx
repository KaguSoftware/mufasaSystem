import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Accordion } from "@/components/site/accordion";
import { Container, PageHero } from "@/components/site/section";
import { pageMetadata } from "@/components/site/seo";
import { Button } from "@/components/ui/button";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "public.faq" });
  return pageMetadata({ locale, path: "/faq", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(asLocale(locale));
  const t = await getTranslations("public.faq");
  const items = t.raw("items") as { q: string; a: string }[];
  return (
    <>
      <PageHero title={t("title")} subtitle={t("subtitle")} />
      <Container className="py-12 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <Accordion items={items} />
          <div className="mt-10 rounded-lg border border-border bg-surface-2 p-6 text-center">
            <h2 className="text-xl font-semibold">{t("stillTitle")}</h2>
            <p className="mt-2 text-muted">{t("stillBody")}</p>
            <Button asChild className="mt-4">
              <Link href="/contact">{t("contactCta")}</Link>
            </Button>
          </div>
        </div>
      </Container>
    </>
  );
}
