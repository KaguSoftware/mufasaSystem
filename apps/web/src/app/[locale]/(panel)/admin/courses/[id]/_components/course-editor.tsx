"use client";

import { ArrowDown, ArrowUp, FileText, HelpCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { LEVELS } from "@mufasa/db/schema";
import { t18n, type I18nText } from "@mufasa/config/locales";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Switch, TabsContent, TabsList, TabsRoot, TabsTrigger } from "@/components/ui/controls";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { I18nFields, toI18nValue, type I18nValue } from "@/components/catalog/i18n-fields";
import { useRunAction } from "@/components/catalog/use-run-action";
import { useRouter } from "@/i18n/navigation";
import {
  deleteCourseAction,
  deleteLessonAction,
  deleteUnitAction,
  reorderAction,
  saveCourseAction,
  saveUnitAction,
  setPublishedAction,
} from "@/server/actions/catalog";
import type { CourseEditorData, EditorLesson } from "@/server/dal/catalog";
import { AssetsDialog } from "./assets-dialog";
import { LessonDialog } from "./lesson-dialog";
import { QuizDialog } from "./quiz-dialog";

type ProgramOption = { id: string; name: I18nText };

function move<T>(items: T[], index: number, dir: -1 | 1): T[] | null {
  const j = index + dir;
  if (j < 0 || j >= items.length) return null;
  const copy = [...items];
  [copy[index], copy[j]] = [copy[j]!, copy[index]!];
  return copy;
}

export function CourseEditor({ course, programs }: { course: CourseEditorData; programs: ProgramOption[] }) {
  const t = useTranslations("catalog");
  const locale = useLocale();
  return (
    <>
      <PageHeader title={t18n(course.title, locale)} description={t18n(course.programName, locale)} />
      <TabsRoot defaultValue="syllabus">
        <TabsList>
          <TabsTrigger value="syllabus">{t("syllabus")}</TabsTrigger>
          <TabsTrigger value="details">{t("details")}</TabsTrigger>
        </TabsList>
        <TabsContent value="syllabus">
          <Syllabus course={course} />
        </TabsContent>
        <TabsContent value="details">
          <Details course={course} programs={programs} />
        </TabsContent>
      </TabsRoot>
    </>
  );
}

// ───────────── Details ─────────────

function Details({ course, programs }: { course: CourseEditorData; programs: ProgramOption[] }) {
  const t = useTranslations("catalog");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const run = useRunAction();
  const [programId, setProgramId] = useState<string | null>(course.programId);
  const [slug, setSlug] = useState(course.slug);
  const [title, setTitle] = useState<I18nValue>(toI18nValue(course.title));
  const [description, setDescription] = useState<I18nValue>(toI18nValue(course.description));
  const [level, setLevel] = useState<string | null>(course.level);
  const [ageMin, setAgeMin] = useState(course.ageMin?.toString() ?? "");
  const [ageMax, setAgeMax] = useState(course.ageMax?.toString() ?? "");
  const [coverPath, setCoverPath] = useState(course.coverPath ?? "");
  const [isFree, setIsFree] = useState(course.isFree);
  const [published, setPublished] = useState(course.published);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  async function save() {
    if (!programId || !level) return;
    setSaving(true);
    const res = await run(() =>
      saveCourseAction({
        id: course.id,
        programId,
        slug,
        title,
        description,
        level: level as (typeof LEVELS)[number],
        ageMin: num(ageMin),
        ageMax: num(ageMax),
        coverPath,
        isFree,
        published,
      }),
    );
    setSaving(false);
    setErrors(res.ok ? {} : (res.error.fieldErrors ?? {}));
  }

  async function remove() {
    if (!window.confirm(t("confirmDeleteCourse", { name: t18n(course.title, locale) }))) return;
    const res = await run(() => deleteCourseAction({ id: course.id }), { refresh: false });
    if (res.ok) router.push("/admin/courses");
  }

  return (
    <Card>
      <CardBody className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("program")} required>
            <Select
              value={programId}
              onChange={setProgramId}
              options={programs.map((p) => ({ value: p.id, label: t18n(p.name, locale) }))}
            />
          </Field>
          <Field label={t("slug")} required hint={t("slugHint")} error={errors["slug"] && t("slugInvalid")}>
            <Input value={slug} dir="ltr" onChange={(e) => setSlug(e.target.value)} />
          </Field>
        </div>
        <I18nFields label={t("courseTitle")} required value={title} error={errors["title.en"] ?? errors["title"]} onChange={setTitle} />
        <I18nFields label={t("description")} multiline value={description} onChange={setDescription} />
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label={t("level")}>
            <Select value={level} onChange={setLevel} options={LEVELS.map((l) => ({ value: l, label: t(`level_${l}`) }))} />
          </Field>
          <Field label={t("ageMin")}>
            <Input type="number" min={0} value={ageMin} onChange={(e) => setAgeMin(e.target.value)} />
          </Field>
          <Field label={t("ageMax")}>
            <Input type="number" min={0} value={ageMax} onChange={(e) => setAgeMax(e.target.value)} />
          </Field>
          <Field label={t("coverPath")}>
            <Input value={coverPath} dir="ltr" onChange={(e) => setCoverPath(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-6">
          <Switch label={t("freeCourse")} checked={isFree} onCheckedChange={setIsFree} />
          <Switch label={t("published")} checked={published} onCheckedChange={setPublished} />
        </div>
        <div className="flex justify-between gap-2">
          <Button variant="danger" onClick={remove}>
            <Trash2 className="size-4" /> {tc("delete")}
          </Button>
          <Button loading={saving} onClick={save}>{tc("save")}</Button>
        </div>
      </CardBody>
    </Card>
  );
}

// ───────────── Syllabus ─────────────

type LessonDialogState = { unitId: string; lessonId: string | null } | null;
type UnitDialogState = { id: string | null; title: I18nValue; description: I18nValue } | null;

function Syllabus({ course }: { course: CourseEditorData }) {
  const t = useTranslations("catalog");
  const tc = useTranslations("common");
  const locale = useLocale();
  const run = useRunAction();
  const [lessonDialog, setLessonDialog] = useState<LessonDialogState>(null);
  const [assetsFor, setAssetsFor] = useState<string | null>(null);
  const [quizFor, setQuizFor] = useState<string | null>(null);
  const [unitDialog, setUnitDialog] = useState<UnitDialogState>(null);
  const [unitSaving, setUnitSaving] = useState(false);

  const allLessons = course.units.flatMap((u) => u.lessons);
  const findLesson = (id: string | null): EditorLesson | null => (id ? (allLessons.find((l) => l.id === id) ?? null) : null);

  async function saveUnit() {
    if (!unitDialog) return;
    setUnitSaving(true);
    const res = await run(() =>
      saveUnitAction({ id: unitDialog.id ?? undefined, courseId: course.id, title: unitDialog.title, description: unitDialog.description }),
    );
    setUnitSaving(false);
    if (res.ok) setUnitDialog(null);
  }

  async function reorderUnits(index: number, dir: -1 | 1) {
    const next = move(course.units, index, dir);
    if (next) await run(() => reorderAction({ entity: "units", ids: next.map((u) => u.id) }), { success: false });
  }

  async function reorderLessons(lessons: EditorLesson[], index: number, dir: -1 | 1) {
    const next = move(lessons, index, dir);
    if (next) await run(() => reorderAction({ entity: "lessons", ids: next.map((l) => l.id) }), { success: false });
  }

  return (
    <div className="grid gap-4">
      {course.units.map((unit, ui) => (
        <Card key={unit.id}>
          <CardHeader
            title={t18n(unit.title, locale)}
            description={t("lessonCount", { count: unit.lessons.length })}
            actions={
              <>
                <Button size="icon" variant="ghost" aria-label={t("moveUp")} disabled={ui === 0} onClick={() => reorderUnits(ui, -1)}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label={t("moveDown")} disabled={ui === course.units.length - 1} onClick={() => reorderUnits(ui, 1)}>
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={tc("edit")}
                  onClick={() => setUnitDialog({ id: unit.id, title: toI18nValue(unit.title), description: toI18nValue(unit.description) })}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={tc("delete")}
                  onClick={async () => {
                    if (window.confirm(t("confirmDeleteUnit"))) await run(() => deleteUnitAction({ id: unit.id }));
                  }}
                >
                  <Trash2 className="size-4 text-danger" />
                </Button>
              </>
            }
          />
          <div className="divide-y divide-border">
            {unit.lessons.map((lesson, li) => (
              <div key={lesson.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{t18n(lesson.title, locale)}</span>
                    <Badge>{t(`lessonType_${lesson.type}`)}</Badge>
                    {lesson.isPreview && <Badge tone="success">{t("preview")}</Badge>}
                    {lesson.quizzes.length > 0 && <Badge tone="primary">{t("hasQuiz")}</Badge>}
                  </div>
                  <div className="text-xs text-muted">{lesson.slug}</div>
                </div>
                <Switch
                  checked={lesson.published}
                  aria-label={t("published")}
                  onCheckedChange={(v) => run(() => setPublishedAction({ entity: "lessons", id: lesson.id, published: v }), { success: false })}
                />
                <div className="flex items-center">
                  <Button size="icon" variant="ghost" aria-label={t("moveUp")} disabled={li === 0} onClick={() => reorderLessons(unit.lessons, li, -1)}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={t("moveDown")} disabled={li === unit.lessons.length - 1} onClick={() => reorderLessons(unit.lessons, li, 1)}>
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={t("assets")} onClick={() => setAssetsFor(lesson.id)}>
                    <FileText className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={t("quiz")} onClick={() => setQuizFor(lesson.id)}>
                    <HelpCircle className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={tc("edit")} onClick={() => setLessonDialog({ unitId: unit.id, lessonId: lesson.id })}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={tc("delete")}
                    onClick={async () => {
                      if (window.confirm(t("confirmDeleteLesson", { name: t18n(lesson.title, locale) }))) await run(() => deleteLessonAction({ id: lesson.id }));
                    }}
                  >
                    <Trash2 className="size-4 text-danger" />
                  </Button>
                </div>
              </div>
            ))}
            {unit.lessons.length === 0 && <p className="px-5 py-4 text-sm text-muted">{t("noLessons")}</p>}
            <div className="px-5 py-3">
              <Button size="sm" variant="secondary" onClick={() => setLessonDialog({ unitId: unit.id, lessonId: null })}>
                <Plus className="size-4" /> {t("addLesson")}
              </Button>
            </div>
          </div>
        </Card>
      ))}

      <div>
        <Button variant="secondary" onClick={() => setUnitDialog({ id: null, title: toI18nValue(null), description: toI18nValue(null) })}>
          <Plus className="size-4" /> {t("addUnit")}
        </Button>
      </div>

      <Dialog open={unitDialog !== null} onOpenChange={(o) => !o && setUnitDialog(null)}>
        {unitDialog && (
          <DialogContent title={unitDialog.id ? t("editUnit") : t("addUnit")}>
            <div className="grid gap-5">
              <I18nFields label={t("unitTitle")} required value={unitDialog.title} onChange={(title) => setUnitDialog({ ...unitDialog, title })} />
              <I18nFields label={t("description")} multiline value={unitDialog.description} onChange={(description) => setUnitDialog({ ...unitDialog, description })} />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">{tc("cancel")}</Button>
              </DialogClose>
              <Button loading={unitSaving} onClick={saveUnit}>{tc("save")}</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {lessonDialog && (
        <LessonDialog
          key={lessonDialog.lessonId ?? `new-${lessonDialog.unitId}`}
          unitId={lessonDialog.unitId}
          lesson={findLesson(lessonDialog.lessonId)}
          onClose={() => setLessonDialog(null)}
        />
      )}
      {assetsFor && findLesson(assetsFor) && <AssetsDialog lesson={findLesson(assetsFor)!} onClose={() => setAssetsFor(null)} />}
      {quizFor && findLesson(quizFor) && <QuizDialog lesson={findLesson(quizFor)!} onClose={() => setQuizFor(null)} />}
    </div>
  );
}
