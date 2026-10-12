import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { pageUser } from "@/components/account/page-user";
import { listChildren } from "@/server/dal/family";
import { ChildrenManager } from "../_components/children-manager";

export default async function ParentChildrenPage() {
  const [t, user] = await Promise.all([getTranslations("family"), pageUser()]);
  const children = user?.role === "parent" ? await listChildren(user) : [];
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {user?.role === "parent" && (
        <ChildrenManager
          items={children.map((c) => ({
            ...c,
            consent: c.consent ? { ...c.consent, acceptedAt: c.consent.acceptedAt.toISOString() } : null,
          }))}
        />
      )}
    </>
  );
}
