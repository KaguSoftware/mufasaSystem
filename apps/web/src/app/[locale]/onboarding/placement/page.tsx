import { getLocale, getTranslations } from "next-intl/server";
import { isDbConfigured } from "@mufasa/db";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Link, redirect } from "@/i18n/navigation";
import { isEnabled } from "@/server/flags";
import { getPlacementQuiz, placementTargets } from "@/server/dal/placement";
import { getSession } from "@/server/session";
import { PlacementFlow } from "./_components/placement-flow";

/**
 * Placement test. A student takes it for themself; a parent takes it for a child
 * (`?child=<id>`). Recommendations are shown at the end.
 */
export default async function PlacementPage({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const t = await getTranslations("placement");
  const te = await getTranslations("errors");
  const locale = await getLocale();

  let content: React.ReactNode;
  if (!isDbConfigured()) {
    content = <EmptyState title={te("dbNotConfigured")} description={te("dbNotConfiguredHint")} />;
  } else {
    const session = await getSession();
    if (!session) return redirect({ href: "/sign-in?next=/onboarding/placement", locale });
    const user = session.user;
    const { child } = await searchParams;

    const [enabled, quiz, targets] = await Promise.all([
      isEnabled("placement_test", user),
      getPlacementQuiz(),
      placementTargets(user),
    ]);

    if (!enabled || !quiz || quiz.questions.length === 0) {
      content = (
        <EmptyState
          title={t("unavailable")}
          description={t("unavailableHint")}
          action={
            <Button asChild>
              <Link href="/dashboard">{t("goToDashboard")}</Link>
            </Button>
          }
        />
      );
    } else if (user.role === "student") {
      content = <PlacementFlow quiz={quiz} studentId={user.id} studentName={null} />;
    } else if (user.role === "parent") {
      const target = targets.find((c) => c.id === child);
      if (target) {
        content = <PlacementFlow quiz={quiz} studentId={target.id} studentName={target.name} />;
      } else {
        content = (
          <Card>
            <CardBody className="grid gap-4">
              <p className="font-medium">{t("chooseChild")}</p>
              {targets.length === 0 ? (
                <p className="text-sm text-muted">{t("noChildren")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {targets.map((c) => (
                    <Button key={c.id} asChild variant="secondary">
                      <Link href={`/onboarding/placement?child=${c.id}`}>{c.name}</Link>
                    </Button>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        );
      }
    } else {
      content = <EmptyState title={t("studentsAndParentsOnly")} />;
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mb-8 text-muted">{t("intro")}</p>
      {content}
    </main>
  );
}
