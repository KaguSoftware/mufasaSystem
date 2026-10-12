import { getTranslations } from "next-intl/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { getAccountView, isImpersonating } from "@/server/dal/account";
import { listMyDataRequests } from "@/server/dal/data-requests";
import { listChildren } from "@/server/dal/family";
import { getSession } from "@/server/session";
import { pageUser } from "./page-user";
import { PasswordForm, ProfileForm, StopImpersonatingButton, TwoFactorSection } from "./account-forms";
import { PrivacyData } from "./privacy-data";

/** Shared account screen for every role (profile, password, 2FA for staff, privacy & data). */
export async function AccountPage() {
  const [t, user] = await Promise.all([getTranslations("account"), pageUser()]);
  if (!user) return <PageHeader title={t("title")} />;

  const session = await getSession();
  const [view, requests, children, impersonating] = await Promise.all([
    getAccountView(user),
    listMyDataRequests(user),
    user.role === "parent" ? listChildren(user) : Promise.resolve([]),
    session ? isImpersonating(session.sessionId) : Promise.resolve(false),
  ]);

  const isStaff = user.role === "admin" || user.role === "tutor";
  const subjects = user.isManagedChild
    ? []
    : [
        { id: user.id, name: user.name, isSelf: true },
        ...children.map((c) => ({ id: c.id, name: c.displayName, isSelf: false })),
      ];

  return (
    <>
      <PageHeader title={t("title")} description={user.email.endsWith("@kids.invalid") ? `@${user.username ?? ""}` : user.email} />
      <div className="flex max-w-3xl flex-col gap-6">
        {impersonating && (
          <Card className="border-warning/40 bg-warning-soft">
            <CardHeader title={t("impersonatingTitle")} description={t("impersonatingBody")} actions={<StopImpersonatingButton />} />
          </Card>
        )}

        <Card>
          <CardHeader title={t("profile")} />
          <CardBody>
            <ProfileForm displayName={view.displayName} timezone={user.timezone} nameLocked={user.isManagedChild} />
          </CardBody>
        </Card>

        {user.isManagedChild ? (
          <Card>
            <CardHeader title={t("password")} />
            <CardBody className="text-sm text-muted">{t("pinManagedByParent")}</CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader title={t("password")} />
            <CardBody>
              <PasswordForm />
            </CardBody>
          </Card>
        )}

        {isStaff && (
          <Card>
            <CardHeader title={t("twoFactor")} />
            <CardBody>
              <TwoFactorSection enabled={view.twoFactorEnabled} />
            </CardBody>
          </Card>
        )}

        {!user.isManagedChild && (
          <Card>
            <CardHeader title={t("privacy")} />
            <CardBody>
              <PrivacyData
                subjects={subjects}
                canDelete={!isStaff}
                requests={requests.map((r) => ({
                  id: r.id,
                  subjectName: r.subjectName,
                  type: r.type,
                  status: r.status,
                  createdAt: r.createdAt.toISOString(),
                }))}
              />
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
