"use client";

import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { t18n, type I18nText } from "@mufasa/config/locales";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/controls";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { I18nFields, emptyI18n, type I18nValue } from "@/components/catalog/i18n-fields";
import { useRunAction } from "@/components/catalog/use-run-action";
import { slugify } from "@/lib/catalog-schemas";
import { Link, useRouter } from "@/i18n/navigation";
import { saveCourseAction, setPublishedAction } from "@/server/actions/catalog";
import type { AdminCourseRow } from "@/server/dal/catalog";

type ProgramOption = { id: string; name: I18nText };

export function CoursesManager({
  courses,
  programs,
  activeProgramId,
}: {
  courses: AdminCourseRow[];
  programs: ProgramOption[];
  activeProgramId: string | null;
}) {
  const t = useTranslations("catalog");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const run = useRunAction();
  const programOptions = programs.map((p) => ({ value: p.id, label: t18n(p.name, locale) }));

  const [open, setOpen] = useState(false);
  const [programId, setProgramId] = useState<string | null>(activeProgramId ?? programs[0]?.id ?? null);
  const [title, setTitle] = useState<I18nValue>(emptyI18n());
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!programId) return;
    setSaving(true);
    const res = await run(
      () =>
        saveCourseAction({
          programId,
          slug,
          title,
          level: "beginner",
          isFree: false,
          published: false,
        }),
      { refresh: false },
    );
    setSaving(false);
    if (res.ok) router.push(`/admin/courses/${res.data.id}`);
    else setErrors(res.error.fieldErrors ?? {});
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="w-64 max-w-full">
          <Select
            value={activeProgramId}
            clearable
            placeholder={t("allPrograms")}
            options={programOptions}
            onChange={(v) => router.push(v ? `/admin/courses?program=${v}` : "/admin/courses")}
          />
        </div>
        <Button disabled={programs.length === 0} onClick={() => { setErrors({}); setOpen(true); }}>
          <Plus className="size-4" /> {t("newCourse")}
        </Button>
      </div>

      {courses.length === 0 ? (
        <EmptyState title={t("noCourses")} description={programs.length === 0 ? t("createProgramFirst") : t("noCoursesHint")} />
      ) : (
        <Card>
          <Table>
            <THead>
              <Tr>
                <Th>{t("course")}</Th>
                <Th>{t("program")}</Th>
                <Th>{t("level")}</Th>
                <Th>{t("syllabus")}</Th>
                <Th>{t("access")}</Th>
                <Th>{t("published")}</Th>
              </Tr>
            </THead>
            <TBody>
              {courses.map((c) => (
                <Tr key={c.id}>
                  <Td>
                    <Link href={`/admin/courses/${c.id}`} className="font-medium text-primary hover:underline">
                      {t18n(c.title, locale)}
                    </Link>
                    <div className="text-xs text-muted">{c.slug}</div>
                  </Td>
                  <Td>{t18n(c.programName, locale)}</Td>
                  <Td>{t(`level_${c.level}`)}</Td>
                  <Td className="text-muted">{t("unitLessonCount", { units: c.unitCount, lessons: c.lessonCount })}</Td>
                  <Td>{c.isFree ? <Badge tone="success">{t("free")}</Badge> : <Badge>{t("paid")}</Badge>}</Td>
                  <Td>
                    <Switch
                      checked={c.published}
                      aria-label={t("published")}
                      onCheckedChange={(v) => run(() => setPublishedAction({ entity: "courses", id: c.id, published: v }), { success: false })}
                    />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg" title={t("newCourse")}>
          <div className="grid gap-5">
            <Field label={t("program")} required>
              <Select value={programId} onChange={setProgramId} options={programOptions} />
            </Field>
            <I18nFields
              label={t("courseTitle")}
              required
              value={title}
              error={errors["title.en"] ?? errors["title"]}
              onChange={(v) => {
                setTitle(v);
                if (!slugTouched) setSlug(slugify(v.en) === "item" ? "" : slugify(v.en));
              }}
            />
            <Field label={t("slug")} required hint={t("slugHint")} error={errors["slug"] && t("slugInvalid")}>
              <Input value={slug} dir="ltr" onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} />
            </Field>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">{tc("cancel")}</Button>
            </DialogClose>
            <Button loading={saving} onClick={create}>{tc("create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
