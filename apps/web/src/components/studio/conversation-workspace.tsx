"use client";

import { Check, FileText, Send, Sparkles, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useErrorText } from "@/components/account/use-action-error";
import type { ActionError } from "@/server/action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { Link, useRouter } from "@/i18n/navigation";
import {
  approveScript,
  deleteConversation,
  generateScenes,
  saveScript,
  updateConversation,
  updateScript,
} from "@/server/actions/studio";
import { AGE_BANDS, type AgeBand } from "@/lib/studio-voices";
import { SimpleMarkdown } from "./simple-markdown";

type Msg = { id: string; role: "user" | "model"; content: string };
type ScriptRow = { id: string; version: number; title: string; content: string; status: "draft" | "approved" | "archived" };
type LessonOption = {
  id: string;
  title: string;
  courseTitle: string;
  summary: string | null;
  context: {
    objectives?: string[];
    approach?: string;
    vocabulary?: { term: string; meaning?: string }[];
    ayahRefs?: { surah: number; from: number; to: number }[];
    notes?: string;
  };
};
type Locale = "ar" | "en" | "tr";

export type WorkspaceProps = {
  base: string;
  conversation: { id: string; title: string; locale: string; lessonId: string | null; context: string | null };
  messages: Msg[];
  scripts: ScriptRow[];
  projects: { id: string; title: string; scriptId: string | null }[];
  lessons: LessonOption[];
};

export function ConversationWorkspace(props: WorkspaceProps) {
  const t = useTranslations("studio");
  const errText = useErrorText();
  const router = useRouter();
  const { conversation } = props;

  const [title, setTitle] = useState(conversation.title === "Untitled" ? "" : conversation.title);
  const [lessonId, setLessonId] = useState<string | null>(conversation.lessonId);
  const [locale, setLocale] = useState<Locale>((conversation.locale as Locale) ?? "ar");
  const [context, setContext] = useState(conversation.context ?? "");
  const [ageBand, setAgeBand] = useState<AgeBand>("9-12");
  const [savingCtx, setSavingCtx] = useState(false);

  const [messages, setMessages] = useState<Msg[]>(props.messages);
  const [input, setInput] = useState("");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const streaming = streamingId !== null;
  const lesson = props.lessons.find((l) => l.id === lessonId) ?? null;

  async function saveContext() {
    setSavingCtx(true);
    const res = await updateConversation({
      id: conversation.id,
      title: title.trim() || t("untitled"),
      lessonId,
      locale,
      context: context.trim() || null,
    });
    setSavingCtx(false);
    if (!res.ok) return toast.error(errText(res.error));
    toast.success(t("contextSaved"));
    router.refresh();
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    const sid = `m-${Date.now()}`;
    setStreamingId(sid);
    setMessages((m) => [...m, { id: `u-${sid}`, role: "user", content: text }, { id: sid, role: "model", content: "" }]);
    const dropPlaceholder = () => setMessages((m) => m.filter((x) => x.id !== sid || x.content));
    try {
      const res = await fetch("/api/studio/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversation.id, message: text, ageBand }),
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => null)) as { error?: ActionError } | null;
        toast.error(j?.error ? errText(j.error) : t("chatFailed"));
        dropPlaceholder();
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => m.map((x) => (x.id === sid ? { ...x, content: acc } : x)));
      }
    } catch {
      toast.error(t("chatFailed"));
      dropPlaceholder();
    } finally {
      setStreamingId(null);
      router.refresh();
    }
  }

  async function onSaveAsScript(m: Msg) {
    const res = await saveScript({
      conversationId: conversation.id,
      title: title.trim() || lesson?.title || t("untitled"),
      content: m.content,
    });
    if (!res.ok) return toast.error(errText(res.error));
    toast.success(t("scriptSaved"));
    router.refresh();
  }

  async function onDelete() {
    if (!window.confirm(t("confirmDelete"))) return;
    const res = await deleteConversation({ id: conversation.id });
    if (!res.ok) return toast.error(errText(res.error));
    toast.success(t("deleted"));
    router.push(props.base);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
      {/* Left: lesson and context */}
      <Card className="self-start">
        <CardHeader
          title={t("lessonContext")}
          actions={
            <Button variant="ghost" size="icon" onClick={onDelete} aria-label={t("deleteConversation")}>
              <Trash2 className="size-4" />
            </Button>
          }
        />
        <CardBody className="flex flex-col gap-4">
          <Field label={t("convTitle")}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("untitled")} />
          </Field>
          <Field label={t("lesson")}>
            <Select
              value={lessonId}
              onChange={setLessonId}
              clearable
              placeholder={t("pickLesson")}
              options={props.lessons.map((l) => ({ value: l.id, label: l.title, description: l.courseTitle }))}
            />
          </Field>
          {lesson ? (
            <div className="flex flex-col gap-2 rounded-md bg-surface-2 p-3 text-sm">
              {lesson.summary && <p>{lesson.summary}</p>}
              {lesson.context.objectives?.length ? (
                <div>
                  <p className="font-medium">{t("objectives")}</p>
                  <ul className="ms-4 list-disc">
                    {lesson.context.objectives.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {lesson.context.approach && (
                <p>
                  <span className="font-medium">{t("approach")}: </span>
                  {lesson.context.approach}
                </p>
              )}
              {lesson.context.vocabulary?.length ? (
                <p>
                  <span className="font-medium">{t("vocabulary")}: </span>
                  {lesson.context.vocabulary.map((v) => v.term).join(", ")}
                </p>
              ) : null}
              {lesson.context.ayahRefs?.length ? (
                <p>
                  <span className="font-medium">{t("ayat")}: </span>
                  {lesson.context.ayahRefs.map((r) => `${r.surah}:${r.from}-${r.to}`).join(", ")}
                </p>
              ) : null}
              {lesson.context.notes && (
                <p>
                  <span className="font-medium">{t("notes")}: </span>
                  {lesson.context.notes}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">{t("noLesson")}</p>
          )}
          <Field label={t("language")}>
            <Select
              value={locale}
              onChange={(v) => v && setLocale(v as Locale)}
              options={(["ar", "en", "tr"] as const).map((l) => ({ value: l, label: t(`lang_${l}`) }))}
            />
          </Field>
          <Field label={t("ageBand")}>
            <Select
              value={ageBand}
              onChange={(v) => v && setAgeBand(v as AgeBand)}
              options={AGE_BANDS.map((a) => ({ value: a, label: t(`age_${a}`) }))}
            />
          </Field>
          <Field label={t("extraContext")} hint={t("extraContextHint")}>
            <Textarea value={context} onChange={(e) => setContext(e.target.value)} rows={6} dir="auto" />
          </Field>
          <Button variant="secondary" onClick={saveContext} loading={savingCtx}>
            {t("saveContext")}
          </Button>
        </CardBody>
      </Card>

      {/* Center: chat */}
      <Card className="flex min-h-[70vh] flex-col">
        <div className="flex max-h-[68vh] flex-1 flex-col gap-4 overflow-y-auto p-5">
          {messages.length === 0 && <p className="m-auto max-w-sm text-center text-sm text-muted">{t("emptyChat")}</p>}
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "ms-auto max-w-[85%]" : "me-auto max-w-[92%]"}>
              <p className="mb-1 text-xs font-medium text-muted">{m.role === "user" ? t("you") : t("assistant")}</p>
              <div className={m.role === "user" ? "rounded-lg bg-primary-soft p-3" : "rounded-lg border border-border bg-surface-2 p-3"}>
                {m.role === "model" && !m.content ? (
                  <span className="text-sm text-muted">{t("thinking")}</span>
                ) : (
                  <SimpleMarkdown text={m.content} />
                )}
              </div>
              {m.role === "model" && m.content && m.id !== streamingId && (
                <Button variant="ghost" size="sm" className="mt-1" onClick={() => onSaveAsScript(m)}>
                  <FileText className="size-4" />
                  {t("saveAsScript")}
                </Button>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <form
          className="flex items-end gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={t("chatPlaceholder")}
            rows={2}
            dir="auto"
            className="min-h-12"
          />
          <Button type="submit" loading={streaming} disabled={!input.trim()}>
            <Send className="size-4 rtl:rotate-180" />
            {t("send")}
          </Button>
        </form>
      </Card>

      {/* Right: scripts */}
      <div className="flex flex-col gap-3 self-start">
        <h2 className="text-base font-semibold">{t("scripts")}</h2>
        {props.scripts.length === 0 && <p className="text-sm text-muted">{t("noScripts")}</p>}
        {props.scripts.map((s) => (
          <ScriptCard
            key={`${s.id}-${s.status}-${s.title.length}-${s.content.length}`}
            script={s}
            projects={props.projects.filter((p) => p.scriptId === s.id)}
            base={props.base}
          />
        ))}
      </div>
    </div>
  );
}

function ScriptCard({ script, projects, base }: { script: ScriptRow; projects: WorkspaceProps["projects"]; base: string }) {
  const t = useTranslations("studio");
  const tc = useTranslations("common");
  const errText = useErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(script.title);
  const [content, setContent] = useState(script.content);
  const [busy, setBusy] = useState<"save" | "approve" | "scenes" | null>(null);
  const locked = script.status === "approved";
  const tone = script.status === "approved" ? "success" : script.status === "archived" ? "neutral" : "primary";
  const label = { draft: t("scriptDraft"), approved: t("scriptApproved"), archived: t("scriptArchived") }[script.status];

  const message = (e: ActionError) => (e.code === "conflict" && e.message ? e.message : errText(e));

  async function save() {
    setBusy("save");
    const res = await updateScript({ id: script.id, title, content });
    setBusy(null);
    if (!res.ok) return toast.error(message(res.error));
    toast.success(t("scriptUpdated"));
    router.refresh();
  }
  async function approve() {
    setBusy("approve");
    const res = await approveScript({ id: script.id });
    setBusy(null);
    if (!res.ok) return toast.error(errText(res.error));
    toast.success(t("approved"));
    router.refresh();
  }
  async function scenes() {
    setBusy("scenes");
    const res = await generateScenes({ scriptId: script.id });
    setBusy(null);
    if (!res.ok) return toast.error(message(res.error));
    toast.success(t("scenesGenerated"));
    if (res.data.warnings.length) toast.warning(res.data.warnings.join("\n"));
    router.push(`${base}/project/${res.data.projectId}`);
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{script.title}</p>
            <p className="text-xs text-muted">{t("version", { n: script.version })}</p>
          </div>
          <Badge tone={tone}>{label}</Badge>
        </div>
        {open ? (
          <>
            <Field label={t("scriptTitle")}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} />
            </Field>
            <Field label={t("scriptContent")} hint={locked ? t("locked") : undefined}>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={14} dir="auto" disabled={locked} />
            </Field>
          </>
        ) : (
          <p dir="auto" className="line-clamp-4 whitespace-pre-line text-sm text-muted">
            {script.content}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? tc("cancel") : tc("edit")}
          </Button>
          {open && !locked && (
            <Button size="sm" variant="secondary" onClick={save} loading={busy === "save"}>
              {t("saveScript")}
            </Button>
          )}
          {script.status === "draft" && (
            <Button size="sm" variant="secondary" onClick={approve} loading={busy === "approve"} title={t("approveHint")}>
              <Check className="size-4" />
              {t("approve")}
            </Button>
          )}
          {locked && (
            <Button size="sm" onClick={scenes} loading={busy === "scenes"}>
              <Sparkles className="size-4" />
              {busy === "scenes" ? t("generating") : t("generateScenes")}
            </Button>
          )}
        </div>
        {projects.map((p) => (
          <Link key={p.id} href={`${base}/project/${p.id}`} className="text-sm text-primary hover:underline">
            {t("openProject")}: {p.title}
          </Link>
        ))}
      </CardBody>
    </Card>
  );
}
