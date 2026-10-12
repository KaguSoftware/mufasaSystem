import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { pageUser } from "@/components/account/page-user";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import { getConversationDetail, getProjectView, listStudioLessons } from "@/server/dal/studio";
import { isEnabled } from "@/server/flags";
import { AppError } from "@/server/errors";
import { ConversationWorkspace } from "./conversation-workspace";
import { ProjectEditor } from "./project-editor";
import type { StudioBase } from "./studio-index";

const uuid = z.string().uuid();

async function guard(title: string) {
  const [t, user] = await Promise.all([getTranslations("studio"), pageUser()]);
  const header = <PageHeader title={title} />;
  if (!user || (user.role !== "tutor" && user.role !== "admin")) return { t, user: null, early: header };
  if (!(await isEnabled("ai_studio", user))) {
    return { t, user: null, early: <><PageHeader title={t("title")} /><EmptyState title={t("disabled")} /></> };
  }
  return { t, user, early: null };
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <p className="mb-2 text-sm">
      <Link href={href} className="text-primary hover:underline">
        {label}
      </Link>
    </p>
  );
}

function notFoundOnAppError(err: unknown): never {
  if (err instanceof AppError && (err.code === "not_found" || err.code === "forbidden")) notFound();
  throw err;
}

export async function StudioConversationPage({ id, base }: { id: string; base: StudioBase }) {
  const { t, user, early } = await guard((await getTranslations("studio"))("title"));
  if (!user) return early;
  if (!uuid.safeParse(id).success) notFound();
  const locale = await getLocale();
  const [detail, lessons] = await Promise.all([
    getConversationDetail(user, id).catch(notFoundOnAppError),
    listStudioLessons(user, locale),
  ]);
  const { conversation, messages, scripts, projects } = detail;
  return (
    <>
      <BackLink href={base} label={t("backToStudio")} />
      <ConversationWorkspace
        base={base}
        conversation={{
          id: conversation.id,
          title: conversation.title,
          locale: conversation.locale,
          lessonId: conversation.lessonId,
          context: conversation.context,
        }}
        messages={messages.map((m) => ({ id: m.id, role: m.role, content: m.content }))}
        scripts={scripts.map((s) => ({ id: s.id, version: s.version, title: s.title, content: s.content, status: s.status }))}
        projects={projects.map((p) => ({ id: p.id, title: p.title, scriptId: p.scriptId }))}
        lessons={lessons}
      />
    </>
  );
}

export async function StudioProjectPage({ id, base }: { id: string; base: StudioBase }) {
  const { t, user, early } = await guard((await getTranslations("studio"))("title"));
  if (!user) return early;
  if (!uuid.safeParse(id).success) notFound();
  const locale = await getLocale();
  const view = await getProjectView(user, id, locale).catch(notFoundOnAppError);
  return (
    <>
      <BackLink href={base} label={t("backToStudio")} />
      <ProjectEditor
        key={view.project.updatedAt.getTime()}
        base={base}
        project={{
          id: view.project.id,
          title: view.project.title,
          status: view.project.status,
          voice: view.project.voice,
          locale: view.project.locale,
          scriptId: view.project.scriptId,
        }}
        doc={view.doc}
        audioUrls={view.audioUrls}
        outputUrl={view.outputUrl}
        lesson={view.lesson}
      />
    </>
  );
}
