import { BarChart3, BookOpenCheck, MonitorPlay, ShieldCheck, Video } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Section, SectionHeading } from "./section";

/** Icons are matched by position to public.features.items. */
const ICONS = [MonitorPlay, Video, BookOpenCheck, BarChart3, ShieldCheck];

export async function Features() {
  const t = await getTranslations("public.features");
  const items = t.raw("items") as { title: string; body: string }[];
  return (
    <Section tone="soft">
      <SectionHeading title={t("title")} subtitle={t("subtitle")} />
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((f, i) => {
          const Icon = ICONS[i % ICONS.length]!;
          return (
            <li key={f.title} className="rounded-lg border border-border bg-surface p-6 shadow-card">
              <span className="flex size-11 items-center justify-center rounded-md bg-primary-soft text-primary">
                <Icon className="size-6" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-muted">{f.body}</p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
