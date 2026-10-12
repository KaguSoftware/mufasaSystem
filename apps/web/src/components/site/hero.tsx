import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Container, Decor } from "./section";
import { Mascot } from "./mascot";

export async function Hero() {
  const t = await getTranslations("public.hero");
  return (
    <section className="relative overflow-hidden bg-primary-soft">
      <Decor />
      <Container className="relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="inline-block rounded-full bg-accent-soft px-3 py-1 text-sm font-medium">{t("eyebrow")}</p>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">{t("title")}</h1>
          <p className="mt-5 max-w-xl text-pretty text-lg text-muted">{t("subtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/sign-up">{t("cta")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/programs">{t("secondary")}</Link>
            </Button>
          </div>
          <p className="mt-4 max-w-xl text-sm text-muted">{t("note")}</p>
        </div>
        <div className="mx-auto w-full max-w-xs sm:max-w-sm">
          <Mascot alt={t("mascotAlt")} priority />
        </div>
      </Container>
    </section>
  );
}
