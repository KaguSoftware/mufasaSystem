import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/misc";
import { pageUser } from "@/components/account/page-user";
import { listCertificates } from "@/server/dal/certificates";
import { CertificatesPanel } from "./_components/certificates-panel";

type SearchParams = { q?: string; page?: string };

export default async function AdminCertificatesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [t, sp, user] = await Promise.all([getTranslations("certificates"), searchParams, pageUser()]);
  if (!user || user.role !== "admin") return <PageHeader title={t("adminTitle")} />;

  const data = await listCertificates(user, { q: sp.q, page: Number(sp.page) || 1 });

  return (
    <>
      <PageHeader title={t("adminTitle")} description={t("adminSubtitle")} />
      <CertificatesPanel
        q={sp.q ?? ""}
        page={data.page}
        total={data.total}
        pageSize={data.pageSize}
        rows={data.rows.map((r) => ({
          ...r,
          issuedAt: r.issuedAt.toISOString(),
          revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
        }))}
      />
    </>
  );
}
