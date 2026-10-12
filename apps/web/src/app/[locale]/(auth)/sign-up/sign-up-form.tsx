"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { authClient, signUp } from "@/lib/auth-client";
import { Link } from "@/i18n/navigation";
import { MIN_SELF_SIGNUP_AGE } from "@/lib/policy";
import { canSelfSignup } from "@/lib/minor";
import { completeSignup } from "@/server/actions/signup";
import { Button } from "@/components/ui/button";
import { Checkbox, RadioGroup } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const LOCALE_LABELS = [
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
  { value: "tr", label: "Türkçe" },
];

export function SignUpForm() {
  const t = useTranslations("auth");
  const current = useLocale();
  const [role, setRole] = useState<"parent" | "student">("parent");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [consent, setConsent] = useState(false);
  const [preset, setPreset] = useState<string>(current);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = t("requiredField");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = t("emailInvalid");
    if (password.length < 8) next.password = t("passwordTooShort");
    const year = Number(birthYear);
    if (role === "student") {
      if (!birthYear || !Number.isInteger(year)) next.birthYear = t("requiredField");
      else if (!canSelfSignup(year, MIN_SELF_SIGNUP_AGE)) next.birthYear = t("under13");
    }
    if (!consent) next.consent = t("consentRequired");
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const created = await signUp.email({ name: name.trim(), email: email.trim(), password });
      if (created.error) return setFormError(created.error.code === "USER_ALREADY_EXISTS" ? t("emailTaken") : t("genericError"));

      const done = await completeSignup({
        role,
        displayName: name.trim(),
        birthYear: role === "student" ? year : undefined,
        locale: preset as "en" | "ar" | "tr",
      });
      if (!done.ok) {
        if (done.error.fieldErrors?.birthYear) {
          setErrors({ birthYear: t("under13") });
          return;
        }
        return setFormError(t("genericError"));
      }
      // The session is cookie-cached: refresh it so the new role is visible immediately.
      await authClient.getSession({ query: { disableCookieCache: true } });
      await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: "email-verification" }).catch(() => undefined);
      const q = new URLSearchParams({ email: email.trim(), next: `/${preset}/onboarding` });
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload so the new session cookie is picked up
      window.location.assign(`/${preset}/verify-email?${q.toString()}`);
    } catch {
      setFormError(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label={t("iAmA")}>
        <RadioGroup
          value={role}
          onValueChange={(v) => setRole(v as "parent" | "student")}
          options={[
            { value: "parent", label: t("roleParent"), description: t("roleParentDesc") },
            { value: "student", label: t("roleStudent"), description: t("roleStudentDesc") },
          ]}
        />
      </Field>

      <Field label={t("name")} htmlFor="su-name" error={errors.name} required>
        <Input id="su-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} />
      </Field>
      <Field label={t("email")} htmlFor="su-email" error={errors.email} required>
        <Input id="su-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(errors.email)} />
      </Field>
      <Field label={t("password")} htmlFor="su-password" hint={t("passwordHint")} error={errors.password} required>
        <Input id="su-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(errors.password)} />
      </Field>

      {role === "student" && (
        <Field label={t("birthYear")} htmlFor="su-year" hint={t("birthYearHint")} error={errors.birthYear} required>
          <Input
            id="su-year"
            inputMode="numeric"
            maxLength={4}
            placeholder="2010"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ""))}
            aria-invalid={Boolean(errors.birthYear)}
          />
        </Field>
      )}

      <Field label={t("language")}>
        <Select options={LOCALE_LABELS} value={preset} onChange={(v) => v && setPreset(v)} searchable={false} />
      </Field>

      <div className="flex flex-col gap-1">
        <Checkbox checked={consent} onCheckedChange={(c) => setConsent(c === true)} label={t("consentLabel")} />
        {errors.consent && <p className="text-xs text-danger">{errors.consent}</p>}
      </div>

      {formError && (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      )}

      <Button type="submit" loading={busy}>
        {t("createAccount")}
      </Button>

      <p className="text-center text-sm text-muted">
        {t("haveAccount")}{" "}
        <Link href="/sign-in" className="font-medium text-primary hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </form>
  );
}
