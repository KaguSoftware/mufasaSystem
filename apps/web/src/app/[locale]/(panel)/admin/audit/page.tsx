import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { pageUser } from "@/components/account/page-user";
import { listAudit } from "@/server/dal/audit-admin";
import { AuditTable } from "./_components/audit-table";

type SearchParams = { entity?: string; action?: string; page?: string };

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [t, sp, user] = await Promise.all([getTranslations("admin"), searchParams, pageUser()]);
  if (!user || user.role !== "admin") return <PageHeader title={t("auditTitle")} />;
  const data = await listAudit(user, { entity: sp.entity, action: sp.action, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title={t("auditTitle")} description={t("auditSubtitle")} />
      <AuditTable
        entity={sp.entity ?? null}
        action={sp.action ?? ""}
        entities={data.entities}
        page={data.page}
        total={data.total}
        pageSize={data.pageSize}
        rows={data.rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      />
    </>
  );
}
