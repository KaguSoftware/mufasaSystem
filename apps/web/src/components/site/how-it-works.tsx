import { getLocale, getTranslations } from "next-intl/server";
import { Section, SectionHeading } from "./section";

export async function HowItWorks() {
  const t = await getTranslations("public.how");
  const locale = await getLocale();
  const steps = t.raw("steps") as { title: string; body: string }[];
  return (
    <Section>
      <SectionHeading title={t("title")} subtitle={t("subtitle")} />
      <ol className="grid gap-6 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="rounded-lg border border-border bg-surface p-6 shadow-card">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-fg">
              {new Intl.NumberFormat(locale).format(i + 1)}
            </span>
            <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
            <p className="mt-2 text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
