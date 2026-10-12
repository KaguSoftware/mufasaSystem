import type { Metadata } from "next";
import { Mail, MessageCircle } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale } from "@/i18n/routing";
import { Container, PageHero } from "@/components/site/section";
import { pageMetadata } from "@/components/site/seo";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { whatsappLink } from "@/lib/billing-math";
import { getSiteContact } from "@/server/dal/public";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "public.contact" });
  return pageMetadata({ locale, path: "/contact", title: t("metaTitle"), description: t("metaDescription") });
}

/**
 * Deliberately no contact form: there is no backend for it. WhatsApp (prefilled
 * deep link) and email are the contact channels. Add a form action here later if needed.
 */
export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(asLocale(locale));
  const t = await getTranslations("public.contact");
  const contact = await getSiteContact();
  return (
    <>
      <PageHero title={t("title")} subtitle={t("subtitle")} />
      <Container className="py-12 sm:py-16">
        <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
          <Card>
            <CardBody>
              <MessageCircle className="size-7 text-primary" aria-hidden />
              <h2 className="mt-3 text-xl font-semibold">{t("whatsappTitle")}</h2>
              <p className="mt-2 text-muted">{t("whatsappBody")}</p>
              <Button asChild size="lg" className="mt-5">
                <a href={whatsappLink(contact.whatsapp, t("whatsappMessage"))} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-5" aria-hidden />
                  {t("whatsappCta")}
                </a>
              </Button>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Mail className="size-7 text-primary" aria-hidden />
              <h2 className="mt-3 text-xl font-semibold">{t("emailTitle")}</h2>
              <p className="mt-2 text-muted">{t("emailBody")}</p>
              <p className="mt-3 font-medium" dir="ltr">
                {contact.email}
              </p>
              <Button asChild size="lg" variant="outline" className="mt-4">
                <a href={`mailto:${contact.email}`}>{t("emailCta")}</a>
              </Button>
            </CardBody>
          </Card>
        </div>
      </Container>
    </>
  );
}
