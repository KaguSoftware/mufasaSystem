import { getLocale, getTranslations } from "next-intl/server";
import { MessageSquare, Clapperboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { pageUser } from "@/components/account/page-user";
import { Link } from "@/i18n/navigation";
import { listConversations, listProjects } from "@/server/dal/studio";
import { isEnabled } from "@/server/flags";
import { NewConversationButton } from "./new-conversation-button";

export type StudioBase = "/tutor/studio" | "/admin/studio";

const STATUS_TONE = { published: "success", failed: "danger", rendered: "primary" } as const;

export async function StudioIndex({ base }: { base: StudioBase }) {
  const [t, locale, user] = await Promise.all([getTranslations("studio"), getLocale(), pageUser()]);
  const header = <PageHeader title={t("title")} description={t("subtitle")} />;
  if (!user || (user.role !== "tutor" && user.role !== "admin")) return header;
  if (!(await isEnabled("ai_studio", user))) return <>{header}<EmptyState title={t("disabled")} /></>;

  const [conversations, projects] = await Promise.all([listConversations(user), listProjects(user)]);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} actions={<NewConversationButton base={base} />} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("conversations")} />
          <CardBody className="flex flex-col gap-2">
            {conversations.length === 0 && <EmptyState icon={<MessageSquare className="size-8" />} title={t("noConversations")} />}
            {conversations.map((c) => (
              <Link key={c.id} href={`${base}/${c.id}`} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 hover:bg-surface-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.title === "Untitled" ? t("untitled") : c.title}</p>
                  <p className="text-xs text-muted">
                    {fmt.format(c.updatedAt)}
                    {user.role === "admin" && ` · ${t("owner", { name: c.ownerName })}`}
                  </p>
                </div>
                <Badge>{c.locale.toUpperCase()}</Badge>
              </Link>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("projects")} />
          <CardBody className="flex flex-col gap-2">
            {projects.length === 0 && <EmptyState icon={<Clapperboard className="size-8" />} title={t("noProjects")} />}
            {projects.map((p) => (
              <Link key={p.id} href={`${base}/project/${p.id}`} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 hover:bg-surface-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="text-xs text-muted">{fmt.format(p.updatedAt)}</p>
                </div>
                <Badge tone={STATUS_TONE[p.status as keyof typeof STATUS_TONE]}>{t(`status_${p.status}`)}</Badge>
              </Link>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
