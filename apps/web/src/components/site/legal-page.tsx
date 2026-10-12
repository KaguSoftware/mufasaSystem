import { TriangleAlert } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Container, PageHero } from "./section";

export type LegalDoc = "privacy" | "terms" | "kvkk" | "cookies";

/** Shared layout for the four legal pages. All text is TEMPLATE copy pending legal review. */
export async function LegalPage({ doc }: { doc: LegalDoc }) {
  const t = await getTranslations("legal");
  const locale = await getLocale();
  const sections = t.raw(`${doc}.sections`) as { title: string; body: string }[];
  return (
    <>
      <PageHero title={t(`${doc}.title`)} subtitle={t(`${doc}.intro`)} />
      <Container className="py-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <div
            role="note"
            className="flex items-start gap-3 rounded-lg border border-warning bg-warning-soft p-4 text-sm"
          >
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            <p>{t("templateBanner")}</p>
          </div>
          <p className="mt-4 text-sm text-muted">{t("lastUpdated")}</p>
          <div className="mt-8 space-y-8">
            {sections.map((s, i) => (
              <section key={s.title}>
                <h2 className="text-xl font-semibold">
                  {new Intl.NumberFormat(locale).format(i + 1)}. {s.title}
                </h2>
                <p className="mt-2 text-pretty text-muted">{s.body}</p>
              </section>
            ))}
          </div>
          <p className="mt-10 border-t border-border pt-6 text-sm text-muted">{t("contactNote")}</p>
        </div>
      </Container>
    </>
  );
}
