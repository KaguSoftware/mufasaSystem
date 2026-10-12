"use client";

import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { t18n } from "@mufasa/config/locales";
import { useRunAction } from "@/components/catalog/use-run-action";
import { AyahRangePicker, type RangeValue, type SurahOption } from "@/components/quran/ayah-range-picker";
import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/controls";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createHomeworkAction } from "@/server/actions/homework";

type I18n = Parameters<typeof t18n>[0];

export type HomeworkOptions = {
  groups: { id: string; name: string }[];
  students: { id: string; name: string }[];
  lessons: { id: string; title: I18n; course: I18n }[];
  quizzes: { id: string; title: I18n }[];
  surahs: SurahOption[];
};

type Target = "free" | "lesson" | "quiz" | "recitation";

export function CreateHomeworkDialog({ options }: { options: HomeworkOptions }) {
  const t = useTranslations("homework");
  const locale = useLocale();
  const run = useRunAction();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"group" | "student">(options.groups.length ? "group" : "student");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [target, setTarget] = useState<Target>("free");
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [range, setRange] = useState<RangeValue>({ surah: null, from: null, to: null });
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (mode === "group" && !groupId) next.assignee = t("required");
    if (mode === "student" && !studentId) next.assignee = t("required");
    if (!title.trim()) next.title = t("required");
    if (!dueAt) next.dueAt = t("required");
    else if (new Date(dueAt).getTime() < Date.now()) next.dueAt = t("dueInPast");
    if (target === "lesson" && !lessonId) next.target = t("required");
    if (target === "quiz" && !quizId) next.target = t("required");
    if (target === "recitation" && (!range.surah || !range.from || !range.to)) next.target = t("required");
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    const res = await run(
      () =>
        createHomeworkAction({
          groupId: mode === "group" ? groupId : null,
          studentId: mode === "student" ? studentId : null,
          title: title.trim(),
          instructions: instructions.trim() || null,
          targetType: target,
          lessonId: target === "lesson" ? lessonId : null,
          quizId: target === "quiz" ? quizId : null,
          surah: target === "recitation" ? range.surah : null,
          ayahFrom: target === "recitation" ? range.from : null,
          ayahTo: target === "recitation" ? range.to : null,
          // The picker value is local wall-clock time; convert to an instant.
          dueAt: new Date(dueAt!).toISOString(),
        }),
      { success: t("created") },
    );
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setTitle("");
      setInstructions("");
      setDueAt(null);
      setLessonId(null);
      setQuizId(null);
      setRange({ surah: null, from: null, to: null });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          {t("create")}
        </Button>
      </DialogTrigger>
      <DialogContent title={t("create")} description={t("createHint")} size="lg">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as "group" | "student")}
            className="grid gap-2 sm:grid-cols-2"
            options={[
              { value: "group", label: t("assignGroup") },
              { value: "student", label: t("assignStudent") },
            ]}
          />
          <Field label={mode === "group" ? t("group") : t("student")} error={errors.assignee} required>
            {mode === "group" ? (
              <Select
                value={groupId}
                onChange={setGroupId}
                placeholder={t("selectGroup")}
                emptyText={t("noGroups")}
                options={options.groups.map((g) => ({ value: g.id, label: g.name }))}
              />
            ) : (
              <Select
                searchable
                value={studentId}
                onChange={setStudentId}
                placeholder={t("selectStudent")}
                emptyText={t("noStudents")}
                options={options.students.map((s) => ({ value: s.id, label: s.name }))}
              />
            )}
          </Field>
          <Field label={t("titleLabel")} error={errors.title} htmlFor="hw-title" required>
            <Input id="hw-title" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={t("instructions")} htmlFor="hw-instr">
            <Textarea id="hw-instr" rows={3} maxLength={4000} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </Field>
          <Field label={t("targetType")} required>
            <Select
              value={target}
              onChange={(v) => v && setTarget(v as Target)}
              options={[
                { value: "free", label: t("target_free"), description: t("target_free_hint") },
                { value: "lesson", label: t("target_lesson"), description: t("target_lesson_hint") },
                { value: "quiz", label: t("target_quiz"), description: t("target_quiz_hint") },
                { value: "recitation", label: t("target_recitation"), description: t("target_recitation_hint") },
              ]}
            />
          </Field>
          {target === "lesson" && (
            <Field label={t("lesson")} error={errors.target} required>
              <Select
                searchable
                value={lessonId}
                onChange={setLessonId}
                placeholder={t("selectLesson")}
                options={options.lessons.map((l) => ({
                  value: l.id,
                  label: t18n(l.title, locale),
                  group: t18n(l.course, locale),
                }))}
              />
            </Field>
          )}
          {target === "quiz" && (
            <Field label={t("quiz")} error={errors.target} hint={t("quizHint")} required>
              <Select
                searchable
                value={quizId}
                onChange={setQuizId}
                placeholder={t("selectQuiz")}
                emptyText={t("noQuizzes")}
                options={options.quizzes.map((q) => ({ value: q.id, label: t18n(q.title, locale) }))}
              />
            </Field>
          )}
          {target === "recitation" && (
            <div>
              <AyahRangePicker surahs={options.surahs} value={range} onChange={setRange} idPrefix="hw" />
              {errors.target && <p className="mt-1 text-sm text-danger">{errors.target}</p>}
            </div>
          )}
          <Field label={t("dueAt")} error={errors.dueAt} required>
            <DatePicker withTime value={dueAt} onChange={setDueAt} min={new Date()} invalid={Boolean(errors.dueAt)} />
          </Field>
          <DialogFooter>
            <Button type="submit" loading={busy}>
              {t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
