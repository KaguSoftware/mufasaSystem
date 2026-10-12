import { MessageSquare } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { pageUser } from "@/components/account/page-user";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { isEnabled } from "@/server/flags";
import { getThread, listRecipients, listThreads } from "@/server/dal/messages";
import { NewThreadDialog, ThreadPane } from "./thread-client";

/**
 * Shared messaging screen for parents and tutors (admins may open either panel).
 * Child safety is enforced in server/dal/messages.ts: minors never appear here.
 */
export async function MessagesView({ base, threadId }: { base: "parent" | "tutor"; threadId?: string }) {
  const [t, locale, user] = await Promise.all([getTranslations("messaging"), getLocale(), pageUser()]);
  if (!user) return <PageHeader title={t("title")} />;
  if (!(await isEnabled("parent_messaging", user))) {
    return (
      <>
        <PageHeader title={t("title")} />
        <EmptyState icon={<MessageSquare className="size-8" />} title={t("disabled")} />
      </>
    );
  }
  if (user.isManagedChild) return <PageHeader title={t("title")} description={t("minorsNotAllowed")} />;

  const [threads, recipients] = await Promise.all([listThreads(user), listRecipients(user)]);
  const selected = threadId && threads.some((x) => x.id === threadId) ? await getThread(user, threadId) : null;
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: user.timezone });
  const short = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: user.timezone });

  return (
    <>
      <PageHeader
        title={t("title")}
        description={base === "parent" ? t("parentSubtitle") : t("tutorSubtitle")}
        actions={<NewThreadDialog recipients={recipients} base={base} />}
      />
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Card className={cn("overflow-hidden", selected && "hidden lg:block")}>
          {threads.length === 0 ? (
            <EmptyState className="border-0" icon={<MessageSquare className="size-8" />} title={t("noThreads")} description={t("noThreadsHint")} />
          ) : (
            <ul className="divide-y divide-border">
              {threads.map((th) => (
                <li key={th.id}>
                  <Link
                    href={`/${base}/messages?thread=${th.id}`}
                    className={cn("block px-4 py-3 transition-colors hover:bg-surface-2", th.id === selected?.id && "bg-primary-soft/40")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm", th.unread > 0 ? "font-semibold" : "font-medium")}>{th.subject}</span>
                      <span className="shrink-0 text-xs text-muted">{short.format(th.lastMessageAt)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">{th.otherNames.join(", ")}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="truncate text-sm text-muted">{th.lastMessage}</p>
                      {th.unread > 0 && <Badge tone="primary">{th.unread}</Badge>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className={cn(!selected && "hidden lg:block")}>
          {selected ? (
            <ThreadPane
              backHref={`/${base}/messages`}
              thread={{
                id: selected.id,
                subject: selected.subject,
                aboutStudentName: selected.aboutStudentName,
                members: selected.members.map((m) => m.name),
                readOnly: selected.readOnly,
                messages: selected.messages.map((m) => ({
                  id: m.id,
                  mine: m.senderId === user.id,
                  senderName: m.senderName,
                  body: m.body,
                  time: fmt.format(m.createdAt),
                })),
              }}
            />
          ) : (
            <EmptyState icon={<MessageSquare className="size-8" />} title={t("selectThread")} />
          )}
        </div>
      </div>
    </>
  );
}
