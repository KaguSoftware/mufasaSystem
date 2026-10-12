"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { authClient, signIn } from "@/lib/auth-client";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "@/components/ui/controls";

/** Sign-in with email or student username + PIN. `next` already includes the locale prefix, so we hard-navigate. */
export function SignInForm({ googleEnabled, next }: { googleEnabled: boolean; next: string | null }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");

  const destination = next ?? `/${locale}/dashboard`;
  const go = () => window.location.assign(destination);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await signIn.email({ email: email.trim(), password });
      if (res.error) return setError(t("invalidCredentials"));
      if (res.data && "twoFactorRedirect" in res.data && res.data.twoFactorRedirect) return setNeedsCode(true);
      go();
    } catch {
      setError(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function submitUsername(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await signIn.username({ username: username.trim().toLowerCase(), password: pin });
      if (res.error) return setError(t("invalidCredentials"));
      go();
    } catch {
      setError(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await authClient.twoFactor.verifyTotp({ code: code.trim() });
      if (res.error) return setError(t("invalidCode"));
      go();
    } catch {
      setError(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    try {
      await signIn.social({ provider: "google", callbackURL: destination });
    } catch {
      setError(t("genericError"));
    }
  }

  if (needsCode) {
    return (
      <form onSubmit={submitCode} className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("twoFactorBody")}</p>
        <Field label={t("twoFactorCode")} htmlFor="totp" error={error ?? undefined}>
          <Input id="totp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
        </Field>
        <Button type="submit" loading={busy} disabled={code.trim().length !== 6}>
          {t("verify")}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <TabsRoot defaultValue="email">
        <TabsList className="w-full">
          <TabsTrigger value="email" className="flex-1">
            {t("tabEmail")}
          </TabsTrigger>
          <TabsTrigger value="student" className="flex-1">
            {t("tabStudent")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email">
          <form onSubmit={submitEmail} className="flex flex-col gap-4">
            <Field label={t("email")} htmlFor="si-email">
              <Input id="si-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label={t("password")} htmlFor="si-password">
              <Input id="si-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Link href="/forgot-password" className="self-start text-sm text-primary hover:underline">
              {t("forgotPassword")}
            </Link>
            <Button type="submit" loading={busy}>
              {t("signIn")}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="student">
          <form onSubmit={submitUsername} className="flex flex-col gap-4">
            <Field label={t("username")} htmlFor="si-username">
              <Input id="si-username" autoComplete="username" autoCapitalize="none" required value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field label={t("pin")} htmlFor="si-pin" hint={t("pinHint")}>
              <Input
                id="si-pin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                pattern="\d{6}"
                maxLength={6}
                required
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              />
            </Field>
            <Button type="submit" loading={busy} disabled={pin.length !== 6}>
              {t("signIn")}
            </Button>
          </form>
        </TabsContent>
      </TabsRoot>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {googleEnabled && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
            {t("or")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="outline" onClick={google}>
            {t("continueWithGoogle")}
          </Button>
        </>
      )}

      <p className="text-center text-sm text-muted">
        {t("noAccount")}{" "}
        <Link href="/sign-up" className="font-medium text-primary hover:underline">
          {t("signUp")}
        </Link>
      </p>
    </div>
  );
}
