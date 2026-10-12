import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Mascot } from "@/components/site/mascot";
import { Button } from "@/components/ui/button";

/** Localized 404 for any notFound() inside /[locale]. */
export default async function NotFound() {
  const t = await getTranslations("public.notFound");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="w-40">
        <Mascot alt="" />
      </div>
      <h1 className="text-balance text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-pretty text-muted">{t("body")}</p>
      <Button asChild size="lg">
        <Link href="/">{t("home")}</Link>
      </Button>
    </main>
  );
}
