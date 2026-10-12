import { ArrowRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { t18n } from "@mufasa/config/locales";
import { Link } from "@/i18n/navigation";
import type { CourseListItem, Program } from "@/server/dal/catalog";
import type { listActivePlans } from "@/server/dal/billing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/billing-math";
import { cn } from "@/lib/cn";

type Plan = Awaited<ReturnType<typeof listActivePlans>>[number];

/** "Ages 6 to 9" style label, or null when the course has no age range. */
export async function ageLabel(min: number | null, max: number | null): Promise<string | null> {
  const t = await getTranslations("public.course");
  if (min != null && max != null) return t("ages", { min, max });
  if (min != null) return t("agesFrom", { min });
  if (max != null) return t("agesUpTo", { max });
  return null;
}

export async function ProgramCard({ program, courseCount }: { program: Program; courseCount?: number }) {
  const locale = await getLocale();
  const t = await getTranslations("public.programs");
  const desc = t18n(program.description, locale);
  return (
    <Card className="flex h-full flex-col p-6 transition-shadow hover:shadow-pop">
      <h3 className="text-xl font-semibold">{t18n(program.name, locale)}</h3>
      {desc && <p className="mt-2 line-clamp-4 flex-1 text-muted">{desc}</p>}
      <div className="mt-5 flex items-center justify-between gap-3">
        {courseCount !== undefined ? <Badge tone="primary">{t("courseCount", { count: courseCount })}</Badge> : <span />}
        <Link
          href={`/programs/${program.slug}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {t("explore")}
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
      </div>
    </Card>
  );
}

export async function CourseCard({ course }: { course: CourseListItem }) {
  const locale = await getLocale();
  const t = await getTranslations("public.course");
  const desc = t18n(course.description, locale);
  const ages = await ageLabel(course.ageMin, course.ageMax);
  return (
    <Card className="flex h-full flex-col p-6 transition-shadow hover:shadow-pop">
      <div className="flex flex-wrap gap-2">
        <Badge tone="primary">{t(`levels.${course.level}`)}</Badge>
        {course.isFree && <Badge tone="success">{t("free")}</Badge>}
      </div>
      <h3 className="mt-3 text-lg font-semibold">
        <Link href={`/courses/${course.slug}`} className="hover:underline">
          {t18n(course.title, locale)}
        </Link>
      </h3>
      {desc && <p className="mt-2 line-clamp-3 flex-1 text-muted">{desc}</p>}
      {ages && <p className="mt-4 text-sm text-muted">{ages}</p>}
    </Card>
  );
}

export async function PlanCard({ plan, highlight }: { plan: Plan; highlight?: boolean }) {
  const locale = await getLocale();
  const t = await getTranslations("public.pricing");
  const desc = t18n(plan.description, locale);
  return (
    <Card className={cn("flex h-full flex-col p-6", highlight && "border-primary ring-2 ring-ring")}>
      <h3 className="text-lg font-semibold">{t18n(plan.name, locale)}</h3>
      {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
      <p className="mt-5 flex flex-wrap items-baseline gap-2">
        <span className="text-4xl font-semibold tabular-nums">{formatMoney(plan.priceMinor, plan.currency, locale)}</span>
        <span className="text-sm text-muted">{t(`intervals.${plan.interval}`)}</span>
      </p>
      <ul className="mt-5 flex-1 space-y-2 text-sm">
        <li>{t("seats", { count: plan.seats })}</li>
        {plan.liveClassesPerMonth > 0 && <li>{t("liveClasses", { count: plan.liveClassesPerMonth })}</li>}
        {plan.programIds.length === 0 && <li>{t("allPrograms")}</li>}
        {plan.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <Button asChild className="mt-6" variant={highlight ? "primary" : "outline"} size="lg">
        <Link href="/sign-up">{t("choose")}</Link>
      </Button>
    </Card>
  );
}
