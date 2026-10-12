"use client";

import { Pencil, KeyRound, ShieldCheck, Plus, BarChart3 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { createChild, resetChildPin, updateChild, updateConsent } from "@/server/actions/family";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { useErrorText } from "@/components/account/use-action-error";
import { ConsentFields, DEFAULT_CONSENT, type ConsentValue } from "./consent-fields";

export type ChildItem = {
  id: string;
  displayName: string;
  birthYear: number | null;
  username: string | null;
  consent: (ConsentValue & { acceptedAt: string; policyVersion: string }) | null;
};

const MIN_AGE = 3;
const MAX_AGE = 17;

function validBirthYear(v: string) {
  const y = Number(v);
  const now = new Date().getFullYear();
  return Number.isInteger(y) && y >= now - MAX_AGE && y <= now - MIN_AGE;
}

export function ChildrenManager({ items }: { items: ChildItem[] }) {
  const t = useTranslations("family");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <AddChildDialog />
      </div>
      {items.length === 0 ? (
        <EmptyState title={t("noChildren")} description={t("noChildrenHint")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((c) => (
            <ChildCard key={c.id} child={c} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AddChildDialog() {
  const t = useTranslations("family");
  const errText = useErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [consent, setConsent] = useState<ConsentValue>(DEFAULT_CONSENT);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!displayName.trim()) next.displayName = t("required");
    if (!validBirthYear(birthYear)) next.birthYear = t("birthYearRange", { min: MIN_AGE, max: MAX_AGE });
    if (!/^[a-z0-9_.]{3,30}$/.test(username.trim().toLowerCase())) next.username = t("invalidUsername");
    if (!/^\d{6}$/.test(pin)) next.pin = t("invalidPin");
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const res = await createChild({
      displayName: displayName.trim(),
      birthYear: Number(birthYear),
      username: username.trim().toLowerCase(),
      pin,
      consent,
    });
    setBusy(false);
    if (!res.ok) {
      if (res.error.code === "conflict") return setErrors({ username: t("usernameTaken") });
      return toast.error(errText(res.error));
    }
    toast.success(t("childCreated"));
    setOpen(false);
    setDisplayName("");
    setBirthYear("");
    setUsername("");
    setPin("");
    setConsent(DEFAULT_CONSENT);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          {t("addChild")}
        </Button>
      </DialogTrigger>
      <DialogContent title={t("addChild")} description={t("addChildHint")} size="lg">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("displayName")} hint={t("displayNameHint")} error={errors.displayName} htmlFor="ch-name" required>
              <Input id="ch-name" value={displayName} maxLength={40} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
            <Field label={t("birthYear")} error={errors.birthYear} htmlFor="ch-year" required>
              <Input id="ch-year" inputMode="numeric" maxLength={4} value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label={t("username")} hint={t("usernameHint")} error={errors.username} htmlFor="ch-user" required>
              <Input id="ch-user" autoCapitalize="none" value={username} maxLength={30} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field label={t("pin")} hint={t("pinHint")} error={errors.pin} htmlFor="ch-pin" required>
              <Input id="ch-pin" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
            </Field>
          </div>
          <div className="rounded-md border border-border p-4">
            <p className="mb-1 font-medium">{t("consentTitle")}</p>
            <p className="mb-4 text-sm text-muted">{t("consentIntro")}</p>
            <ConsentFields value={consent} onChange={setConsent} />
          </div>
          <DialogFooter>
            <Button type="submit" loading={busy}>
              {t("addChild")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChildCard({ child }: { child: ChildItem }) {
  const t = useTranslations("family");
  const locale = useLocale();
  const c = child.consent;
  const activeCount = c
    ? [c.allowLiveVideo, c.allowRecitationRecording, c.allowAiFeedback, c.allowSessionRecording].filter(Boolean).length
    : 0;
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{child.displayName}</h3>
          <p className="text-sm text-muted">
            {child.username ? `@${child.username}` : ""}
            {child.birthYear ? ` · ${child.birthYear}` : ""}
          </p>
        </div>
        <Badge tone={child.consent ? "success" : "warning"}>
          {child.consent ? t("consentCount", { count: activeCount }) : t("consentNone")}
        </Badge>
      </div>
      {child.consent && (
        <p className="text-xs text-muted">
          {t("consentFrom", { date: new Date(child.consent.acceptedAt).toLocaleDateString(locale) })}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <EditChildDialog child={child} />
        <ResetPinDialog child={child} />
        <ConsentDialog child={child} />
        <Button asChild variant="ghost" size="sm">
          <Link href={`/parent/progress?child=${child.id}`}>
            <BarChart3 className="size-4" />
            {t("progress")}
          </Link>
        </Button>
      </div>
    </Card>
  );
}

function EditChildDialog({ child }: { child: ChildItem }) {
  const t = useTranslations("family");
  const errText = useErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState(child.displayName);
  const [birthYear, setBirthYear] = useState(String(child.birthYear ?? ""));
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!displayName.trim()) next.displayName = t("required");
    if (!validBirthYear(birthYear)) next.birthYear = t("birthYearRange", { min: MIN_AGE, max: MAX_AGE });
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const res = await updateChild({ childId: child.id, displayName: displayName.trim(), birthYear: Number(birthYear) });
    setBusy(false);
    if (!res.ok) return toast.error(errText(res.error));
    toast.success(t("childUpdated"));
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" />
          {t("edit")}
        </Button>
      </DialogTrigger>
      <DialogContent title={t("editChild")} size="sm">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label={t("displayName")} hint={t("displayNameHint")} error={errors.displayName} htmlFor={`ed-name-${child.id}`}>
            <Input id={`ed-name-${child.id}`} value={displayName} maxLength={40} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          <Field label={t("birthYear")} error={errors.birthYear} htmlFor={`ed-year-${child.id}`}>
            <Input id={`ed-year-${child.id}`} inputMode="numeric" maxLength={4} value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <DialogFooter>
            <Button type="submit" loading={busy}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPinDialog({ child }: { child: ChildItem }) {
  const t = useTranslations("family");
  const errText = useErrorText();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await resetChildPin({ childId: child.id, pin });
    setBusy(false);
    if (!res.ok) return toast.error(errText(res.error));
    toast.success(t("pinReset"));
    setPin("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <KeyRound className="size-4" />
          {t("resetPin")}
        </Button>
      </DialogTrigger>
      <DialogContent title={t("resetPinTitle", { name: child.displayName })} description={t("resetPinHint")} size="sm">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label={t("newPin")} hint={t("pinHint")} htmlFor={`pin-${child.id}`}>
            <Input id={`pin-${child.id}`} inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <DialogFooter>
            <Button type="submit" loading={busy} disabled={pin.length !== 6}>
              {t("resetPin")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConsentDialog({ child }: { child: ChildItem }) {
  const t = useTranslations("family");
  const errText = useErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState<ConsentValue>(
    child.consent
      ? {
          allowLiveVideo: child.consent.allowLiveVideo,
          allowRecitationRecording: child.consent.allowRecitationRecording,
          allowAiFeedback: child.consent.allowAiFeedback,
          allowSessionRecording: child.consent.allowSessionRecording,
        }
      : { allowLiveVideo: false, allowRecitationRecording: false, allowAiFeedback: false, allowSessionRecording: false },
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await updateConsent({ childId: child.id, consent });
    setBusy(false);
    if (!res.ok) return toast.error(errText(res.error));
    toast.success(t("consentSaved"));
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ShieldCheck className="size-4" />
          {t("manageConsent")}
        </Button>
      </DialogTrigger>
      <DialogContent title={t("consentFor", { name: child.displayName })} description={t("consentIntro")} size="md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <ConsentFields value={consent} onChange={setConsent} />
          <DialogFooter>
            <Button type="submit" loading={busy}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
