import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { DatabaseZap } from "lucide-react";
import { isDbConfigured } from "@mufasa/db";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HOME_FOR_ROLE } from "@/components/shell/nav";
import { fmtDateTime } from "@/components/live/format";
import { sessionDetail } from "@/server/dal/live";
import { AppError } from "@/server/errors";
import { getSession } from "@/server/session";
import { LiveRoom } from "./live-room";

export const dynamic = "force-dynamic";

/**
 * Focused full-screen classroom (outside the panel layouts). Access is decided by sessionDetail:
 * only the session's tutor and attendee students get a room; parents and admins see an info card.
 */
export default async function LiveSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const [t, locale] = await Promise.all([getTranslations("live"), getLocale()]);

  if (!isDbConfigured()) {
    return (
      <Shell>
        <Card className="flex items-start gap-3 border-warning/40 bg-warning-soft p-4">
          <DatabaseZap className="mt-0.5 size-5 shrink-0 text-warning" />
          <p className="text-sm">{(await getTranslations("errors"))("dbNotConfigured")}</p>
        </Card>
      </Shell>
    );
  }

  const session = await getSession();
  if (!session) return redirect({ href: `/sign-in?next=/live/${sessionId}`, locale });
  const user = session.user;

  let detail;
  try {
    detail = await sessionDetail(user, sessionId);
  } catch (err) {
    if (err instanceof AppError && (err.code === "not_found" || err.code === "forbidden")) return notFound();
    throw err;
  }

  const exitHref = user.role === "tutor" ? "/tutor/sessions" : HOME_FOR_ROLE[user.role];

  if (detail.viewer === "parent" || detail.viewer === "admin") {
    return (
      <Shell>
        <Card className="flex flex-col gap-3 p-6">
          <h1 className="text-xl font-semibold">{detail.title}</h1>
          <p className="text-sm text-muted">{fmtDateTime(detail.startsAt, user.timezone, locale)}</p>
          <p className="text-sm">{t("observerNote")}</p>
          <div>
            <Button asChild variant="outline">
              <Link href={exitHref}>{t("backToPanel")}</Link>
            </Button>
          </div>
        </Card>
      </Shell>
    );
  }

  return (
    <LiveRoom
      sessionId={detail.id}
      title={detail.title}
      mode={detail.mode}
      status={detail.status}
      role={detail.viewer === "tutor" ? "tutor" : "student"}
      startsAt={detail.startsAt.toISOString()}
      durationMin={detail.durationMin}
      tutorName={detail.tutorName}
      whenLabel={fmtDateTime(detail.startsAt, user.timezone, locale)}
      exitHref={exitHref}
    />
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-4 py-10">{children}</main>;
}
