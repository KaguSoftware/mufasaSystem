import { getLocale, getTranslations } from "next-intl/server";
import { DatabaseZap } from "lucide-react";
import { count, getDb, isDbConfigured, isNull, and, eq, schema, type Role } from "@mufasa/db";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/server/session";
import { Card } from "@/components/ui/card";
import { HOME_FOR_ROLE } from "./nav";
import { PanelShell } from "./panel-shell";

/**
 * Server gate used by every panel layout:
 * - no DB yet → render the shell with a "connect the database" notice (UI is still browsable)
 * - signed out → redirect to sign-in
 * - wrong role → redirect to the user's own panel (admins may enter any panel)
 */
export async function PanelGate({ role, children }: { role: Role; children: React.ReactNode }) {
  const locale = await getLocale();

  if (!isDbConfigured()) {
    const t = await getTranslations("errors");
    return (
      <PanelShell role={role} user={null}>
        <Card className="mb-6 flex items-start gap-3 border-warning/40 bg-warning-soft p-4">
          <DatabaseZap className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-medium">{t("dbNotConfigured")}</p>
            <p className="text-muted">{t("dbNotConfiguredHint")}</p>
          </div>
        </Card>
        {children}
      </PanelShell>
    );
  }

  const session = await getSession();
  if (!session) return redirect({ href: `/sign-in?next=/${role}`, locale });
  const { user } = session;
  if (user.role !== role && user.role !== "admin") return redirect({ href: HOME_FOR_ROLE[user.role], locale });

  const [unread] = await getDb()
    .select({ n: count() })
    .from(schema.notifications)
    .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)));

  return (
    <PanelShell role={role} user={{ name: user.name, email: user.email, role: user.role, image: user.image }} unreadCount={unread?.n ?? 0}>
      {children}
    </PanelShell>
  );
}
