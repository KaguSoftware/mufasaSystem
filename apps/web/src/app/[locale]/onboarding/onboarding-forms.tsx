"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { canSelfSignup } from "@/lib/minor";
import { MIN_SELF_SIGNUP_AGE } from "@/lib/policy";
import { Link, useRouter } from "@/i18n/navigation";
import { completeSignup, updateOwnProfile } from "@/server/actions/signup";
import { useErrorText } from "@/components/account/use-action-error";
import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

/** Social sign-ups choose parent or student here. Same server rules as the sign-up form. */
export function RoleSetup({ defaultName }: { defaultName: string }) {
  const t = useTranslations("auth");
  const tf = useTranslations("family");
  const errText = useErrorText();
  const router = useRouter();
  const locale = useLocale();
  const [role, setRole] = useState<"parent" | "student">("parent");
  const [birthYear, setBirthYear] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const year = Number(birthYear);
    if (role === "student" && !canSelfSignup(year, MIN_SELF_SIGNUP_AGE)) return setError(t("under13"));
    setBusy(true);
    const res = await completeSignup({
      role,
      displayName: defaultName,
      birthYear: role === "student" ? year : undefined,
      locale: locale as "en" | "ar" | "tr",
    });
    setBusy(false);
    if (!res.ok) return res.error.fieldErrors?.birthYear ? setError(t("under13")) : toast.error(errText(res.error));
    await authClient.getSession({ query: { disableCookieCache: true } }).catch(() => undefined);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
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
      {role === "student" && (
        <Field label={tf("birthYear")} hint={t("birthYearHint")} error={error ?? undefined}>
          <Input inputMode="numeric" maxLength={4} value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ""))} />
        </Field>
      )}
      <Button type="submit" loading={busy}>
        {tf("continue")}
      </Button>
    </form>
  );
}

export function StudentOnboarding({
  displayName,
  hasBirthYear,
  isManagedChild,
}: {
  displayName: string;
  hasBirthYear: boolean;
  isManagedChild: boolean;
}) {
  const t = useTranslations("family");
  const ta = useTranslations("auth");
  const errText = useErrorText();
  const [name, setName] = useState(displayName);
  const [birthYear, setBirthYear] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsYear = !hasBirthYear && !isManagedChild;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const year = Number(birthYear);
    if (needsYear && !canSelfSignup(year, MIN_SELF_SIGNUP_AGE)) return setError(ta("under13"));
    setBusy(true);
    const res = await updateOwnProfile({ displayName: name.trim(), birthYear: needsYear ? year : undefined });
    setBusy(false);
    if (!res.ok) return toast.error(errText(res.error));
    setSaved(true);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label={t("displayName")} htmlFor="ob-name">
        <Input id="ob-name" value={name} maxLength={60} disabled={isManagedChild} onChange={(e) => setName(e.target.value)} />
      </Field>
      {needsYear && (
        <Field label={t("birthYear")} htmlFor="ob-year" error={error ?? undefined}>
          <Input id="ob-year" inputMode="numeric" maxLength={4} value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ""))} />
        </Field>
      )}
      {!saved ? (
        <Button type="submit" loading={busy} disabled={!name.trim()}>
          {t("continue")}
        </Button>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/onboarding/placement">{t("startPlacement")}</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/student">{t("goToDashboard")}</Link>
          </Button>
        </div>
      )}
    </form>
  );
}
