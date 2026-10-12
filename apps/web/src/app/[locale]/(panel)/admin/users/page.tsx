import { getTranslations } from "next-intl/server";
import { ROLES, type Role } from "@mufasa/db";
import { PageHeader } from "@/components/ui/misc";
import { pageUser } from "@/components/account/page-user";
import { listDataRequests } from "@/server/dal/data-requests";
import { listUsers } from "@/server/dal/admin-users";
import { UsersPanel } from "./_components/users-panel";

type SearchParams = { q?: string; role?: string; page?: string; tab?: string };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [t, sp, user] = await Promise.all([getTranslations("admin"), searchParams, pageUser()]);
  if (!user || user.role !== "admin") return <PageHeader title={t("usersTitle")} />;

  const role = (ROLES as readonly string[]).includes(sp.role ?? "") ? (sp.role as Role) : undefined;
  const [users, requests] = await Promise.all([
    listUsers(user, { q: sp.q, role, page: Number(sp.page) || 1 }),
    listDataRequests(user),
  ]);

  return (
    <>
      <PageHeader title={t("usersTitle")} description={t("usersSubtitle")} />
      <UsersPanel
        currentUserId={user.id}
        tab={sp.tab === "requests" ? "requests" : "users"}
        q={sp.q ?? ""}
        role={role ?? null}
        users={{
          ...users,
          rows: users.rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
        }}
        requests={requests.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      />
    </>
  );
}
