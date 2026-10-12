import { ArrowRight, MessageCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { whatsappLink } from "@/lib/billing-math";
import type { Program } from "@/server/dal/catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Accordion } from "./accordion";
import { ProgramCard } from "./cards";
import { Container, Decor, Section, SectionHeading } from "./section";

/** Programs from the DB, or two generic cards when none are published yet. */
export async function ProgramsPreview({ programs }: { programs: Program[] }) {
  const t = await getTranslations("public.programsPreview");
  const fallback = t.raw("fallback") as { title: string; body: string }[];
  return (
    <Section>
      <SectionHeading title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {programs.length > 0
          ? programs.slice(0, 3).map((p) => <ProgramCard key={p.id} program={p} />)
          : fallback.map((f) => (
              <Card key={f.title} className="flex h-full flex-col p-6">
                <h3 className="text-xl font-semibold">{f.title}</h3>
                <p className="mt-2 flex-1 text-muted">{f.body}</p>
                <div className="mt-5">
                  <Badge>{t("fallbackNote")}</Badge>
                </div>
              </Card>
            ))}
      </div>
      <div className="mt-8 text-center">
        <Button asChild variant="outline" size="lg">
          <Link href="/programs">
            {t("viewAll")}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </Link>
        </Button>
      </div>
    </Section>
  );
}

export async function PricingTeaser() {
  const t = await getTranslations("public.pricingTeaser");
  return (
    <Section tone="soft">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h2>
        <p className="mt-3 text-pretty text-lg text-muted">{t("body")}</p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/pricing">{t("cta")}</Link>
        </Button>
      </div>
    </Section>
  );
}

/**
 * PLACEHOLDER: testimonials section.
 * There are no real testimonials yet, so this intentionally renders nothing.
 * When real, consented parent quotes exist, render them here (never invent any).
 */
export function Testimonials() {
  return null;
}

export async function FaqTeaser() {
  const t = await getTranslations("public.faqTeaser");
  const tf = await getTranslations("public.faq");
  const items = (tf.raw("items") as { q: string; a: string }[]).slice(0, 4);
  return (
    <Section>
      <SectionHeading title={t("title")} />
      <div className="mx-auto max-w-3xl">
        <Accordion items={items} />
        <div className="mt-6 text-center">
          <Button asChild variant="outline">
            <Link href="/faq">{t("cta")}</Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}

export async function FinalCta({ whatsapp }: { whatsapp: string }) {
  const t = await getTranslations("public.finalCta");
  return (
    <section className="relative overflow-hidden bg-primary text-primary-fg">
      <Decor className="opacity-20" />
      <Container className="relative py-14 text-center sm:py-20">
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-lg opacity-90">{t("body")}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" variant="secondary">
            <Link href="/sign-up">{t("signUp")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-primary-fg/60 text-primary-fg hover:bg-primary-hover">
            <a href={whatsappLink(whatsapp, t("whatsappMessage"))} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-5" aria-hidden />
              {t("whatsapp")}
            </a>
          </Button>
        </div>
      </Container>
    </section>
  );
}
