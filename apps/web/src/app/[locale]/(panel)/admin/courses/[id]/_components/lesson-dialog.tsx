"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { LESSON_TYPES, type LessonContext, type LessonType } from "@mufasa/db/schema";
import { Button } from "@/components/ui/button";
import { Switch, TabsContent, TabsList, TabsRoot, TabsTrigger } from "@/components/ui/controls";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { I18nFields, toI18nValue, type I18nValue } from "@/components/catalog/i18n-fields";
import { useRunAction } from "@/components/catalog/use-run-action";
import { saveLessonAction } from "@/server/actions/catalog";
import type { EditorLesson } from "@/server/dal/catalog";

const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/** "term = meaning" per line. */
function parseVocabulary(s: string): NonNullable<LessonContext["vocabulary"]> {
  return lines(s).map((l) => {
    const i = l.indexOf("=");
    return i === -1 ? { term: l } : { term: l.slice(0, i).trim(), meaning: l.slice(i + 1).trim() || undefined };
  });
}

/** "surah:from-to" per line, e.g. 2:255-257. Returns null when a line is malformed. */
function parseAyahRefs(s: string): NonNullable<LessonContext["ayahRefs"]> | null {
  const out: NonNullable<LessonContext["ayahRefs"]> = [];
  for (const l of lines(s)) {
    const m = /^(\d{1,3})\s*:\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?$/.exec(l);
    if (!m) return null;
    const surah = Number(m[1]);
    const from = Number(m[2]);
    const to = m[3] ? Number(m[3]) : from;
    if (surah < 1 || surah > 114 || from < 1 || to < from) return null;
    out.push({ surah, from, to });
  }
  return out;
}

export function LessonDialog({
  unitId,
  lesson,
  onClose,
}: {
  unitId: string;
  lesson: EditorLesson | null;
  onClose: () => void;
}) {
  const t = useTranslations("catalog");
  const tc = useTranslations("common");
  const run = useRunAction();
  const ctx = lesson?.context ?? {};

  const [type, setType] = useState<string | null>(lesson?.type ?? "video");
  const [title, setTitle] = useState<I18nValue>(toI18nValue(lesson?.title));
  const [summary, setSummary] = useState<I18nValue>(toI18nValue(lesson?.summary));
  const [body, setBody] = useState<I18nValue>(toI18nValue(lesson?.body));
  const [videoPath, setVideoPath] = useState(lesson?.videoPath ?? "");
  const [duration, setDuration] = useState(lesson?.videoDurationSec?.toString() ?? "");
  const [xp, setXp] = useState((lesson?.xpReward ?? 10).toString());
  const [isPreview, setIsPreview] = useState(lesson?.isPreview ?? false);
  const [published, setPublished] = useState(lesson?.published ?? false);
  const [objectives, setObjectives] = useState((ctx.objectives ?? []).join("\n"));
  const [approach, setApproach] = useState(ctx.approach ?? "");
  const [vocabulary, setVocabulary] = useState((ctx.vocabulary ?? []).map((v) => (v.meaning ? `${v.term} = ${v.meaning}` : v.term)).join("\n"));
  const [ayahRefs, setAyahRefs] = useState((ctx.ayahRefs ?? []).map((r) => `${r.surah}:${r.from}${r.to !== r.from ? `-${r.to}` : ""}`).join("\n"));
  const [notes, setNotes] = useState(ctx.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  async function save() {
    const refs = parseAyahRefs(ayahRefs);
    if (!refs) {
      toast.error(t("ayahRefsInvalid"));
      return;
    }
    setSaving(true);
    const res = await run(() =>
      saveLessonAction({
        id: lesson?.id,
        unitId,
        slug: lesson?.slug,
        type: (type ?? "video") as LessonType,
        title,
        summary,
        body,
        videoPath,
        videoDurationSec: duration.trim() === "" ? null : Number(duration),
        context: {
          objectives: lines(objectives),
          approach: approach.trim() || undefined,
          vocabulary: parseVocabulary(vocabulary),
          ayahRefs: refs,
          notes: notes.trim() || undefined,
        },
        isPreview,
        published,
        xpReward: Number(xp) || 0,
      }),
    );
    setSaving(false);
    if (res.ok) onClose();
    else setErrors(res.error.fieldErrors ?? {});
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="xl" title={lesson ? t("editLesson") : t("addLesson")}>
        <TabsRoot defaultValue="basics">
          <TabsList>
            <TabsTrigger value="basics">{t("tabBasics")}</TabsTrigger>
            <TabsTrigger value="content">{t("tabContent")}</TabsTrigger>
            <TabsTrigger value="context">{t("tabContext")}</TabsTrigger>
          </TabsList>

          <TabsContent value="basics" className="grid gap-5">
            <I18nFields label={t("lessonTitle")} required value={title} error={errors["title.en"] ?? errors["title"]} onChange={setTitle} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("lessonType")}>
                <Select value={type} onChange={setType} options={LESSON_TYPES.map((l) => ({ value: l, label: t(`lessonType_${l}`) }))} />
              </Field>
              <Field label={t("videoPath")} hint={t("videoPathHint")}>
                <Input value={videoPath} dir="ltr" onChange={(e) => setVideoPath(e.target.value)} />
              </Field>
              <Field label={t("videoDuration")}>
                <Input type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("xpReward")}>
                <Input type="number" min={0} max={1000} value={xp} onChange={(e) => setXp(e.target.value)} />
              </Field>
              <div className="flex items-end pb-2">
                <Switch label={t("previewLesson")} checked={isPreview} onCheckedChange={setIsPreview} />
              </div>
              <div className="flex items-end pb-2">
                <Switch label={t("published")} checked={published} onCheckedChange={setPublished} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="content" className="grid gap-5">
            <I18nFields label={t("summary")} multiline value={summary} onChange={setSummary} />
            <I18nFields label={t("bodyMarkdown")} multiline value={body} onChange={setBody} />
          </TabsContent>

          <TabsContent value="context" className="grid gap-5">
            <p className="text-sm text-muted">{t("contextIntro")}</p>
            <Field label={t("objectives")} hint={t("onePerLine")}>
              <Textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} />
            </Field>
            <Field label={t("approach")}>
              <Textarea value={approach} onChange={(e) => setApproach(e.target.value)} />
            </Field>
            <Field label={t("vocabulary")} hint={t("vocabularyHint")}>
              <Textarea value={vocabulary} onChange={(e) => setVocabulary(e.target.value)} />
            </Field>
            <Field label={t("ayahRefs")} hint={t("ayahRefsHint")}>
              <Textarea value={ayahRefs} dir="ltr" onChange={(e) => setAyahRefs(e.target.value)} />
            </Field>
            <Field label={t("notes")}>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </TabsContent>
        </TabsRoot>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">{tc("cancel")}</Button>
          </DialogClose>
          <Button loading={saving} onClick={save}>{tc("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
