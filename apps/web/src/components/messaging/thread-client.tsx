"use client";

import { ArrowLeft, Plus, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { markThreadRead, sendMessage, startThread } from "@/server/actions/messages";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { useErrorText } from "@/components/account/use-action-error";

const POLL_MS = 15_000;

export type ThreadData = {
  id: string;
  subject: string;
  aboutStudentName: string | null;
  members: string[];
  readOnly: boolean;
  messages: { id: string; mine: boolean; senderName: string; body: string; time: string }[];
};

export function ThreadPane({ thread, backHref }: { thread: ThreadData; backHref: string }) {
  const t = useTranslations("messaging");
  const errText = useErrorText();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const count = thread.messages.length;

  // Simple polling instead of websockets.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [router]);

  // Mark as read when opened and whenever new messages arrive.
  useEffect(() => {
    if (!thread.readOnly) void markThreadRead({ threadId: thread.id });
    bottom.current?.scrollIntoView({ block: "end" });
  }, [thread.id, thread.readOnly, count]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    const res = await sendMessage({ threadId: thread.id, body: body.trim() });
    setBusy(false);
    if (!res.ok) return toast.error(errText(res.error));
    setBody("");
    router.refresh();
  }

  return (
    <Card className="flex h-[70dvh] flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link href={backHref} className="rounded-md p-1.5 text-muted hover:bg-surface-2 lg:hidden" aria-label={t("back")}>
          <ArrowLeft className="size-4 rtl:rotate-180" />
        </Link>
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{thread.subject}</h2>
          <p className="truncate text-xs text-muted">
            {thread.members.join(", ")}
            {thread.aboutStudentName ? ` · ${t("about", { name: thread.aboutStudentName })}` : ""}
          </p>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {thread.messages.map((m) => (
          <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[80%] rounded-lg px-3 py-2 text-sm", m.mine ? "bg-primary text-primary-fg" : "bg-surface-2")}>
              {!m.mine && <p className="mb-0.5 text-xs font-medium opacity-70">{m.senderName}</p>}
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={cn("mt-1 text-[11px]", m.mine ? "opacity-80" : "text-muted")}>{m.time}</p>
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      {thread.readOnly ? (
        <p className="border-t border-border px-4 py-3 text-sm text-muted">{t("readOnly")}</p>
      ) : (
        <form onSubmit={send} className="flex items-end gap-2 border-t border-border p-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
            rows={2}
            className="min-h-10 flex-1"
            placeholder={t("writeMessage")}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send(e as unknown as React.FormEvent);
            }}
          />
          <Button type="submit" loading={busy} disabled={!body.trim()} aria-label={t("send")}>
            <Send className="size-4 rtl:-scale-x-100" />
            <span className="hidden sm:inline">{t("send")}</span>
          </Button>
        </form>
      )}
    </Card>
  );
}

export type RecipientItem = {
  id: string;
  name: string;
  role: "tutor" | "admin" | "parent";
  students: { id: string; name: string }[];
};

export function NewThreadDialog({ recipients, base }: { recipients: RecipientItem[]; base: "parent" | "tutor" }) {
  const t = useTranslations("messaging");
  const tr = useTranslations("roles");
  const errText = useErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const recipient = recipients.find((r) => r.id === recipientId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipientId) return;
    setBusy(true);
    const res = await startThread({
      recipientId,
      subject: subject.trim(),
      body: body.trim(),
      aboutStudentId: studentId ?? undefined,
    });
    setBusy(false);
    if (!res.ok) return toast.error(errText(res.error));
    toast.success(t("sent"));
    setOpen(false);
    setSubject("");
    setBody("");
    setRecipientId(null);
    setStudentId(null);
    router.push(`/${base}/messages?thread=${res.data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={recipients.length === 0}>
          <Plus className="size-4" />
          {t("newThread")}
        </Button>
      </DialogTrigger>
      <DialogContent title={t("newThread")} description={t("newThreadHint")}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label={t("recipient")} required>
            <Select
              options={recipients.map((r) => ({ value: r.id, label: r.name, description: tr(r.role) }))}
              value={recipientId}
              onChange={(v) => {
                setRecipientId(v);
                setStudentId(null);
              }}
            />
          </Field>
          {recipient && recipient.students.length > 0 && (
            <Field label={t("aboutStudent")}>
              <Select
                clearable
                options={recipient.students.map((s) => ({ value: s.id, label: s.name }))}
                value={studentId}
                onChange={setStudentId}
                placeholder={t("aboutStudentNone")}
              />
            </Field>
          )}
          <Field label={t("subject")} htmlFor="nt-subject" required>
            <Input id="nt-subject" value={subject} maxLength={140} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label={t("message")} htmlFor="nt-body" required>
            <Textarea id="nt-body" value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="submit" loading={busy} disabled={!recipientId || !subject.trim() || !body.trim()}>
              {t("send")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
