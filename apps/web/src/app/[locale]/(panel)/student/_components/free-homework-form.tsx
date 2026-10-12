"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRunAction } from "@/components/catalog/use-run-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Field, Textarea } from "@/components/ui/input";
import { submitFreeHomeworkAction } from "@/server/actions/homework";

export function FreeHomeworkForm({ homeworkId, studentId, title }: { homeworkId: string; studentId: string; title: string }) {
  const t = useTranslations("homework");
  const run = useRunAction();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && !file) {
      setError(t("answerRequired"));
      return;
    }
    setError(null);
    const form = new FormData();
    form.set("homeworkId", homeworkId);
    form.set("studentId", studentId);
    form.set("text", text);
    if (file) form.set("file", file);
    setBusy(true);
    const res = await run(() => submitFreeHomeworkAction(form), { success: t("submittedToast") });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setText("");
      setFile(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Send className="size-4" />
          {t("submit")}
        </Button>
      </DialogTrigger>
      <DialogContent title={title} description={t("submitHint")} size="lg">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label={t("yourAnswer")} error={error ?? undefined} htmlFor="hw-text">
            <Textarea id="hw-text" rows={5} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <FileDropzone
            accept="image/*,application/pdf,audio/*"
            maxSizeMb={10}
            value={file}
            onChange={setFile}
            label={t("attach")}
            hint={t("attachHint")}
            disabled={busy}
          />
          <DialogFooter>
            <Button type="submit" loading={busy}>
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
