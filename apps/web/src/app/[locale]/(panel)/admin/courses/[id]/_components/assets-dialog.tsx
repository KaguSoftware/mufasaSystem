"use client";

import { Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { t18n } from "@mufasa/config/locales";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { I18nFields, emptyI18n, type I18nValue } from "@/components/catalog/i18n-fields";
import { useRunAction } from "@/components/catalog/use-run-action";
import { deleteLessonAssetAction, saveLessonAssetAction } from "@/server/actions/catalog";
import type { EditorLesson } from "@/server/dal/catalog";

const KINDS = ["pdf", "image", "audio", "link", "worksheet"] as const;

export function AssetsDialog({ lesson, onClose }: { lesson: EditorLesson; onClose: () => void }) {
  const t = useTranslations("catalog");
  const tc = useTranslations("common");
  const locale = useLocale();
  const run = useRunAction();
  const [kind, setKind] = useState<string | null>("pdf");
  const [title, setTitle] = useState<I18nValue>(emptyI18n());
  const [path, setPath] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    setSaving(true);
    const res = await run(() =>
      saveLessonAssetAction({ lessonId: lesson.id, kind: (kind ?? "pdf") as (typeof KINDS)[number], title, path, url }),
    );
    setSaving(false);
    if (res.ok) {
      setTitle(emptyI18n());
      setPath("");
      setUrl("");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg" title={t("assets")} description={t18n(lesson.title, locale)}>
        <div className="grid gap-3">
          {lesson.assets.length === 0 && <p className="text-sm text-muted">{t("noAssets")}</p>}
          {lesson.assets.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge>{t(`assetKind_${a.kind}`)}</Badge>
                  <span className="truncate text-sm font-medium">{t18n(a.title, locale)}</span>
                </div>
                <div className="truncate text-xs text-muted" dir="ltr">{a.url ?? a.path}</div>
              </div>
              <Button size="icon" variant="ghost" aria-label={tc("delete")} onClick={() => run(() => deleteLessonAssetAction({ id: a.id }))}>
                <Trash2 className="size-4 text-danger" />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 border-t border-border pt-5">
          <p className="text-sm font-medium">{t("addAsset")}</p>
          <I18nFields label={t("assetTitle")} required value={title} onChange={setTitle} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("assetKind")}>
              <Select value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: t(`assetKind_${k}`) }))} />
            </Field>
            <Field label={t("assetPath")} hint={t("assetPathHint")}>
              <Input value={path} dir="ltr" onChange={(e) => setPath(e.target.value)} />
            </Field>
            <Field label={t("assetUrl")}>
              <Input value={url} dir="ltr" onChange={(e) => setUrl(e.target.value)} />
            </Field>
          </div>
          <div>
            <Button loading={saving} onClick={add}>
              <Plus className="size-4" /> {tc("add")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
