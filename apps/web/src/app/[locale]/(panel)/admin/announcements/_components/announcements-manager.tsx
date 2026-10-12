"use client";

import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { t18n, type I18nText } from "@mufasa/config/locales";
import type { Role } from "@mufasa/db/schema";
import { useRouter } from "@/i18n/navigation";
import { deleteAnnouncement, saveAnnouncement } from "@/server/actions/announcements";
import { useErrorText } from "@/components/account/use-action-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/controls";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

type Item = {
  id: string;
  title: I18nText;
  body: I18nText;
  audience: string[];
  publishedAt: string | null;
  expiresAt: string | null;
  status: "draft" | "live" | "expired";
};

const ROLE_LIST: readonly Role[] = ["admin", "tutor", "parent", "student"];

export function AnnouncementsManager({ items }: { items: Item[] }) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [editing, setEditing] = useState<Item | "new" | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          {t("newAnnouncement")}
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<Megaphone className="size-8" />} title={t("noAnnouncements")} />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((a) => {
            const status = a.status;
            return (
              <Card key={a.id} className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold">{t18n(a.title, locale)}</h3>
                    <Badge tone={status === "live" ? "success" : status === "draft" ? "neutral" : "warning"}>{t(`ann_${status}`)}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{t18n(a.body, locale)}</p>
                  <p className="mt-1 text-xs text-muted">
                    {a.audience.length ? a.audience.join(", ") : t("audienceEveryone")}
                    {a.expiresAt ? ` · ${t("expiresOn", { date: new Date(a.expiresAt).toLocaleDateString(locale) })}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(a)}>
                    <Pencil className="size-4" />
                    {t("edit")}
                  </Button>
                  <DeleteButton id={a.id} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {editing && <AnnouncementDialog item={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function DeleteButton({ id }: { id: string }) {
  const t = useTranslations("admin");
  const errText = useErrorText();
  const router = useRouter();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2 className="size-4" />
          {t("delete")}
        </Button>
      </DialogTrigger>
      <DialogContent title={t("deleteAnnouncementTitle")} description={t("deleteAnnouncementBody")} size="sm">
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("cancel")}</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              variant="danger"
              onClick={async () => {
                const res = await deleteAnnouncement({ id });
                if (!res.ok) return toast.error(errText(res.error));
                toast.success(t("deleted"));
                router.refresh();
              }}
            >
              {t("delete")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnnouncementDialog({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const t = useTranslations("admin");
  const errText = useErrorText();
  const router = useRouter();
  const [title, setTitle] = useState({ en: item?.title.en ?? "", ar: item?.title.ar ?? "", tr: item?.title.tr ?? "" });
  const [body, setBody] = useState({ en: item?.body.en ?? "", ar: item?.body.ar ?? "", tr: item?.body.tr ?? "" });
  const [audience, setAudience] = useState<string[]>(item?.audience ?? []);
  const [published, setPublished] = useState(Boolean(item?.publishedAt));
  const [expires, setExpires] = useState<string | null>(item?.expiresAt ? item.expiresAt.slice(0, 10) : null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await saveAnnouncement({
      id: item?.id,
      title,
      body,
      audience: audience as Role[],
      published,
      expiresAt: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
    });
    setBusy(false);
    if (!res.ok) return toast.error(errText(res.error));
    toast.success(t("announcementSaved"));
    onClose();
    router.refresh();
  }

  const langs = [
    ["en", "English"],
    ["ar", "العربية"],
    ["tr", "Türkçe"],
  ] as const;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={item ? t("editAnnouncement") : t("newAnnouncement")} size="lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          {langs.map(([code, label]) => (
            <div key={code} className="grid gap-3 rounded-md border border-border p-3">
              <p className="text-xs font-medium text-muted">{label}</p>
              <Field label={t("annTitle")} htmlFor={`an-title-${code}`} required={code === "en"}>
                <Input id={`an-title-${code}`} dir={code === "ar" ? "rtl" : "ltr"} value={title[code]} maxLength={200} onChange={(e) => setTitle({ ...title, [code]: e.target.value })} />
              </Field>
              <Field label={t("annBody")} htmlFor={`an-body-${code}`} required={code === "en"}>
                <Textarea id={`an-body-${code}`} dir={code === "ar" ? "rtl" : "ltr"} value={body[code]} maxLength={2000} onChange={(e) => setBody({ ...body, [code]: e.target.value })} />
              </Field>
            </div>
          ))}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("annAudience")} hint={t("annAudienceHint")}>
              <Select
                multiple
                options={ROLE_LIST.map((r) => ({ value: r, label: r }))}
                value={audience}
                onChange={setAudience}
                placeholder={t("audienceEveryone")}
                searchable={false}
              />
            </Field>
            <Field label={t("annExpires")}>
              <DatePicker value={expires} onChange={setExpires} />
            </Field>
          </div>
          <Switch checked={published} onCheckedChange={setPublished} label={t("annPublished")} />
          <DialogFooter>
            <Button type="submit" loading={busy} disabled={!title.en.trim() || !body.en.trim()}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
