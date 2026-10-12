import type { Metadata } from "next";
import { Landmark, CreditCard, MessageCircle } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale } from "@/i18n/routing";
import { PlanCard } from "@/components/site/cards";
import { Container, PageHero, SectionHeading } from "@/components/site/section";
import { pageMetadata } from "@/components/site/seo";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { whatsappLink } from "@/lib/billing-math";
import { listActivePlans } from "@/server/dal/billing";
import { getSiteContact, safePublic } from "@/server/dal/public";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "public.pricing" });
  return pageMetadata({ locale, path: "/pricing", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(asLocale(locale));
  const t = await getTranslations("public.pricing");
  const [plans, contact] = await Promise.all([safePublic(listActivePlans, []), getSiteContact()]);
  const wa = whatsappLink(contact.whatsapp, t("whatsappMessage"));

  return (
    <>
      <PageHero title={t("title")} subtitle={t("subtitle")} />
      <Container className="py-12 sm:py-16">
        {plans.length === 0 ? (
          <EmptyState
            title={t("emptyTitle")}
            description={t("emptyBody")}
            action={
              <Button asChild>
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" aria-hidden />
                  {t("whatsappCta")}
                </a>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((p, i) => (
              <PlanCard key={p.id} plan={p} highlight={plans.length > 2 && i === 1} />
            ))}
          </div>
        )}

        <div className="mt-16">
          <SectionHeading title={t("paymentTitle")} subtitle={t("paymentSubtitle")} />
          <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
            <Card>
              <CardBody>
                <Landmark className="size-6 text-primary" aria-hidden />
                <h3 className="mt-3 text-lg font-semibold">{t("bankTitle")}</h3>
                <p className="mt-2 text-muted">{t("bankBody")}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <CreditCard className="size-6 text-primary" aria-hidden />
                <h3 className="mt-3 text-lg font-semibold">{t("cardTitle")}</h3>
                <p className="mt-2 text-muted">{t("cardBody")}</p>
              </CardBody>
            </Card>
          </div>
          {plans.length > 0 && (
            <p className="mt-8 text-center text-muted">
              {t("questions")}{" "}
              <a href={wa} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                {t("whatsappCta")}
              </a>
            </p>
          )}
        </div>
      </Container>
    </>
  );
}
