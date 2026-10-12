import { getTranslations, setRequestLocale } from "next-intl/server";
import { asLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/** Temporary landing; the public-site module replaces this. */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(asLocale(locale));
  const t = await getTranslations("site");
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">{t("heroTitle")}</h1>
      <p className="text-lg text-muted">{t("heroSubtitle")}</p>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <Link href="/sign-up">{t("heroCta")}</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/ui">UI kit</Link>
        </Button>
      </div>
    </main>
  );
}
