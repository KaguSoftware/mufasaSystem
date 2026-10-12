"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { t18n } from "@mufasa/config/locales";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/controls";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { I18nFields, emptyI18n, toI18nValue, type I18nValue } from "@/components/catalog/i18n-fields";
import { useRunAction } from "@/components/catalog/use-run-action";
import { slugify } from "@/lib/catalog-schemas";
import { deleteProgramAction, saveProgramAction, setPublishedAction } from "@/server/actions/catalog";
import type { Program } from "@/server/dal/catalog";

type FormState = {
  id?: string;
  slug: string;
  slugTouched: boolean;
  name: I18nValue;
  description: I18nValue;
  icon: string;
  color: string;
  hifz: boolean;
  recitation: boolean;
  liveClasses: boolean;
  placement: boolean;
  published: boolean;
};

const blank = (): FormState => ({
  slug: "",
  slugTouched: false,
  name: emptyI18n(),
  description: emptyI18n(),
  icon: "",
  color: "",
  hifz: false,
  recitation: false,
  liveClasses: false,
  placement: false,
  published: false,
});

function fromProgram(p: Program): FormState {
  return {
    id: p.id,
    slug: p.slug,
    slugTouched: true,
    name: toI18nValue(p.name),
    description: toI18nValue(p.description),
    icon: p.icon ?? "",
    color: p.color ?? "",
    hifz: Boolean(p.features.hifz),
    recitation: Boolean(p.features.recitation),
    liveClasses: Boolean(p.features.liveClasses),
    placement: Boolean(p.features.placement),
    published: p.published,
  };
}

export function ProgramsManager({ programs }: { programs: Program[] }) {
  const t = useTranslations("catalog");
  const tc = useTranslations("common");
  const locale = useLocale();
  const run = useRunAction();
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<FormState>) => setForm((f) => (f ? { ...f, ...p } : f));

  async function save() {
    if (!form) return;
    setSaving(true);
    const res = await run(() =>
      saveProgramAction({
        id: form.id,
        slug: form.slug,
        name: form.name,
        description: form.description,
        icon: form.icon,
        color: form.color,
        features: { hifz: form.hifz, recitation: form.recitation, liveClasses: form.liveClasses, placement: form.placement },
        published: form.published,
      }),
    );
    setSaving(false);
    if (res.ok) {
      setForm(null);
      setErrors({});
    } else setErrors(res.error.fieldErrors ?? {});
  }

  async function remove(p: Program) {
    if (!window.confirm(t("confirmDeleteProgram", { name: t18n(p.name, locale) }))) return;
    await run(() => deleteProgramAction({ id: p.id }));
  }

  const featureLabels = (p: Program) =>
    (["hifz", "recitation", "liveClasses", "placement"] as const).filter((k) => p.features[k]);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => { setErrors({}); setForm(blank()); }}>
          <Plus className="size-4" /> {t("newProgram")}
        </Button>
      </div>

      {programs.length === 0 ? (
        <EmptyState title={t("noPrograms")} description={t("noProgramsHint")} />
      ) : (
        <Card>
          <Table>
            <THead>
              <Tr>
                <Th>{tc("name")}</Th>
                <Th>{t("slug")}</Th>
                <Th>{t("features")}</Th>
                <Th>{t("published")}</Th>
                <Th className="text-end">{tc("actions")}</Th>
              </Tr>
            </THead>
            <TBody>
              {programs.map((p) => (
                <Tr key={p.id}>
                  <Td className="font-medium">{t18n(p.name, locale)}</Td>
                  <Td className="text-muted">{p.slug}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {featureLabels(p).length === 0 && <span className="text-muted">{tc("none")}</span>}
                      {featureLabels(p).map((k) => (
                        <Badge key={k} tone="primary">{t(`feature_${k}`)}</Badge>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    <Switch
                      checked={p.published}
                      aria-label={t("published")}
                      onCheckedChange={(v) => run(() => setPublishedAction({ entity: "programs", id: p.id, published: v }), { success: false })}
                    />
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" aria-label={tc("edit")} onClick={() => { setErrors({}); setForm(fromProgram(p)); }}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={tc("delete")} onClick={() => remove(p)}>
                        <Trash2 className="size-4 text-danger" />
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        {form && (
          <DialogContent size="lg" title={form.id ? t("editProgram") : t("newProgram")}>
            <div className="grid gap-5">
              <I18nFields
                label={tc("name")}
                required
                value={form.name}
                error={errors["name.en"] ?? errors["name"]}
                onChange={(name) =>
                  patch({ name, slug: form.slugTouched ? form.slug : slugify(name.en) === "item" ? "" : slugify(name.en) })
                }
              />
              <Field label={t("slug")} required hint={t("slugHint")} error={errors["slug"] && t("slugInvalid")}>
                <Input value={form.slug} onChange={(e) => patch({ slug: e.target.value, slugTouched: true })} dir="ltr" />
              </Field>
              <I18nFields label={t("description")} multiline value={form.description} onChange={(description) => patch({ description })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("icon")} hint={t("iconHint")}>
                  <Input value={form.icon} onChange={(e) => patch({ icon: e.target.value })} dir="ltr" />
                </Field>
                <Field label={t("color")} hint={t("colorHint")}>
                  <Input value={form.color} onChange={(e) => patch({ color: e.target.value })} dir="ltr" />
                </Field>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">{t("features")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Switch label={t("feature_hifz")} checked={form.hifz} onCheckedChange={(v) => patch({ hifz: v })} />
                  <Switch label={t("feature_recitation")} checked={form.recitation} onCheckedChange={(v) => patch({ recitation: v })} />
                  <Switch label={t("feature_liveClasses")} checked={form.liveClasses} onCheckedChange={(v) => patch({ liveClasses: v })} />
                  <Switch label={t("feature_placement")} checked={form.placement} onCheckedChange={(v) => patch({ placement: v })} />
                </div>
              </div>
              <Switch label={t("published")} checked={form.published} onCheckedChange={(v) => patch({ published: v })} />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">{tc("cancel")}</Button>
              </DialogClose>
              <Button loading={saving} onClick={save}>{tc("save")}</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
