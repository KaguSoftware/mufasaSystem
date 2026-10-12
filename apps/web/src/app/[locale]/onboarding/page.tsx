import { getLocale, getTranslations } from "next-intl/server";
import { eq, getDb, isDbConfigured, schema } from "@mufasa/db";
import { brand } from "@mufasa/config/brand";
import { Link, redirect } from "@/i18n/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { LocaleSwitcher, ThemeToggle } from "@/components/shell/switchers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAccountView } from "@/server/dal/account";
import { listChildren } from "@/server/dal/family";
import { getSession } from "@/server/session";
import { AddChildDialog } from "../(panel)/parent/_components/children-manager";
import { RoleSetup, StudentOnboarding } from "./onboarding-forms";

/** First-run flow after sign-up: parents add their first child, students confirm their profile. */
export default async function OnboardingPage() {
  const [t, locale] = await Promise.all([getTranslations("family"), getLocale()]);
  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Link href="/" className="text-lg font-semibold">
          {brand.name}
        </Link>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-16">{children}</main>
    </div>
  );

  if (!isDbConfigured()) return shell(<AuthCard title={t("onboardingTitle")}>{null}</AuthCard>);

  const session = await getSession();
  if (!session) return redirect({ href: "/sign-in?next=/onboarding", locale });
  const user = session.user;

  const profile = await getDb().query.profiles.findFirst({
    where: eq(schema.profiles.userId, user.id),
    columns: { userId: true },
  });

  // Social sign-ups arrive without a profile: let them pick parent or student (same rules as sign-up).
  if (!profile && user.role === "student" && !user.isManagedChild) {
    return shell(
      <AuthCard title={t("roleSetupTitle")} subtitle={t("roleSetupSubtitle")}>
        <RoleSetup defaultName={user.name} />
      </AuthCard>,
    );
  }

  if (user.role === "parent") {
    const children = await listChildren(user);
    return shell(
      <AuthCard title={t("onboardingParentTitle")} subtitle={t("onboardingParentSubtitle")}>
        <div className="flex flex-col gap-4">
          {children.map((c) => (
            <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{c.displayName}</p>
                {c.username && <p className="text-sm text-muted">@{c.username}</p>}
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/onboarding/placement?child=${c.id}`}>{t("startPlacement")}</Link>
              </Button>
            </Card>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <AddChildDialog />
            <Button asChild variant={children.length ? "primary" : "ghost"}>
              <Link href="/parent">{children.length ? t("goToDashboard") : t("skipForNow")}</Link>
            </Button>
          </div>
        </div>
      </AuthCard>,
    );
  }

  if (user.role === "student") {
    const view = await getAccountView(user);
    return shell(
      <AuthCard title={t("onboardingStudentTitle")} subtitle={t("onboardingStudentSubtitle")}>
        <StudentOnboarding displayName={view.displayName} hasBirthYear={view.birthYear !== null} isManagedChild={user.isManagedChild} />
      </AuthCard>,
    );
  }

  // Staff do not onboard here.
  return redirect({ href: "/dashboard", locale });
}
