import { DatabaseZap } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { isDbConfigured } from "@mufasa/db";
import { Card } from "@/components/ui/card";

/** Title block + card used by every auth page. Shows the "database not connected" notice when needed. */
export async function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations("errors");
  const dbReady = isDbConfigured();
  return (
    <div className="flex flex-col gap-4">
      {!dbReady && (
        <Card className="flex items-start gap-3 border-warning/40 bg-warning-soft p-4">
          <DatabaseZap className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-medium">{t("dbNotConfigured")}</p>
            <p className="text-muted">{t("dbNotConfiguredHint")}</p>
          </div>
        </Card>
      )}
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        <div className={`mt-6 ${dbReady ? "" : "pointer-events-none opacity-60"}`} aria-disabled={!dbReady}>
          {children}
        </div>
      </Card>
    </div>
  );
}
