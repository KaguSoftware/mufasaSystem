"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { usePathname, useRouter } from "@/i18n/navigation";
import { updateAccount, stopImpersonating } from "@/server/actions/account";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { useErrorText } from "./use-action-error";

const LOCALES = [
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
  { value: "tr", label: "Türkçe" },
];

function timezoneOptions(current: string) {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf(key: string): string[] }).supportedValuesOf("timeZone");
  } catch {
    zones = [];
  }
  if (!zones.includes(current)) zones = [current, ...zones];
  return zones.map((z) => ({ value: z, label: z.replace(/_/g, " ") }));
}

export function ProfileForm({
  displayName,
  timezone,
  nameLocked,
}: {
  displayName: string;
  timezone: string;
  nameLocked: boolean;
}) {
  const t = useTranslations("account");
  const errText = useErrorText();
  const current = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [locale, setLocale] = useState<string>(current);
  const [tz, setTz] = useState(timezone);
  const [busy, setBusy] = useState(false);
  const zones = useMemo(() => timezoneOptions(timezone), [timezone]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await updateAccount({ displayName: name.trim(), locale: locale as "en" | "ar" | "tr", timezone: tz });
    setBusy(false);
    if (!res.ok) return toast.error(errText(res.error));
    toast.success(t("saved"));
    // Better Auth caches the session in a cookie: refresh it so the new locale/timezone apply.
    await authClient.getSession({ query: { disableCookieCache: true } }).catch(() => undefined);
    if (locale !== current) router.replace(pathname, { locale: locale as "en" | "ar" | "tr" });
    else router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label={t("displayName")} htmlFor="ac-name" hint={nameLocked ? t("nameManagedByParent") : undefined}>
        <Input id="ac-name" value={name} maxLength={60} disabled={nameLocked} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={t("language")}>
        <Select options={LOCALES} value={locale} onChange={(v) => v && setLocale(v)} searchable={false} />
      </Field>
      <Field label={t("timezone")} className="sm:col-span-2">
        <Select options={zones} value={tz} onChange={(v) => v && setTz(v)} searchable />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" loading={busy} disabled={!name.trim()}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const t = useTranslations("account");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) return setError(t("passwordTooShort"));
    setBusy(true);
    const res = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    setBusy(false);
    if (res.error) return setError(t("passwordWrong"));
    toast.success(t("passwordChanged"));
    setCurrent("");
    setNext("");
  }

  return (
    <form onSubmit={submit} className="grid max-w-md gap-4">
      <Field label={t("currentPassword")} htmlFor="pw-cur">
        <Input id="pw-cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label={t("newPassword")} htmlFor="pw-new" hint={t("passwordHint")} error={error ?? undefined}>
        <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      <div>
        <Button type="submit" loading={busy} disabled={!current || !next}>
          {t("changePassword")}
        </Button>
      </div>
    </form>
  );
}

/** TOTP two-factor setup for staff (Better Auth twoFactor plugin). */
export function TwoFactorSection({ enabled }: { enabled: boolean }) {
  const t = useTranslations("account");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<{ uri: string; secret: string; backupCodes: string[] } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setBusy(true);
    const res = await authClient.twoFactor.enable({ password });
    setBusy(false);
    if (res.error || !res.data || !("totpURI" in res.data)) return setError(t("passwordWrong"));
    const secret = new URL(res.data.totpURI).searchParams.get("secret") ?? "";
    setSetup({ uri: res.data.totpURI, secret, backupCodes: res.data.backupCodes });
    setPassword("");
  }

  async function confirm() {
    setError(null);
    setBusy(true);
    const res = await authClient.twoFactor.verifyTotp({ code: code.trim() });
    setBusy(false);
    if (res.error) return setError(t("invalidCode"));
    toast.success(t("twoFactorOn"));
    setSetup(null);
    setCode("");
    router.refresh();
  }

  async function disable() {
    setError(null);
    setBusy(true);
    const res = await authClient.twoFactor.disable({ password });
    setBusy(false);
    if (res.error) return setError(t("passwordWrong"));
    toast.success(t("twoFactorOff"));
    setPassword("");
    router.refresh();
  }

  if (setup) {
    return (
      <div className="flex max-w-md flex-col gap-4">
        <p className="text-sm text-muted">{t("twoFactorScan")}</p>
        <Field label={t("twoFactorSecret")}>
          <Input readOnly value={setup.secret} onFocus={(e) => e.currentTarget.select()} />
        </Field>
        <Field label={t("twoFactorLink")}>
          <Input readOnly value={setup.uri} onFocus={(e) => e.currentTarget.select()} />
        </Field>
        <div>
          <p className="mb-1 text-sm font-medium">{t("backupCodes")}</p>
          <p className="mb-2 text-xs text-muted">{t("backupCodesHint")}</p>
          <div className="grid grid-cols-2 gap-1 rounded-md bg-surface-2 p-3 font-mono text-xs">
            {setup.backupCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        </div>
        <Field label={t("twoFactorCode")} htmlFor="tf-code" error={error ?? undefined}>
          <Input id="tf-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <div>
          <Button onClick={confirm} loading={busy} disabled={code.length !== 6}>
            {t("twoFactorConfirm")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <p className="text-sm text-muted">{enabled ? t("twoFactorEnabledBody") : t("twoFactorBody")}</p>
      <Field label={t("currentPassword")} htmlFor="tf-pass" error={error ?? undefined}>
        <Input id="tf-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <div>
        {enabled ? (
          <Button variant="danger" onClick={disable} loading={busy} disabled={!password}>
            {t("twoFactorDisable")}
          </Button>
        ) : (
          <Button onClick={start} loading={busy} disabled={!password}>
            {t("twoFactorEnable")}
          </Button>
        )}
      </div>
    </div>
  );
}

export function StopImpersonatingButton() {
  const t = useTranslations("account");
  const errText = useErrorText();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="danger"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const res = await stopImpersonating({});
        if (!res.ok) {
          setBusy(false);
          return toast.error(errText(res.error));
        }
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload so the new session cookie is picked up
        window.location.assign("/");
      }}
    >
      {t("stopImpersonating")}
    </Button>
  );
}
