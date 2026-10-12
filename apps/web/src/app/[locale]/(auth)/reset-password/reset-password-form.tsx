"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

export function ResetPasswordForm({ initialEmail }: { initialEmail: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError(t("passwordTooShort"));
    setBusy(true);
    try {
      const res = await authClient.emailOtp.resetPassword({ email: email.trim(), otp: otp.trim(), password });
      if (res.error) return setError(t("invalidCode"));
      toast.success(t("resetDone"));
      router.push("/sign-in");
    } catch {
      setError(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label={t("email")} htmlFor="rp-email">
        <Input id="rp-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label={t("otpCode")} htmlFor="rp-otp">
        <Input id="rp-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
      </Field>
      <Field label={t("newPassword")} htmlFor="rp-pass" hint={t("passwordHint")} error={error ?? undefined}>
        <Input id="rp-pass" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" loading={busy} disabled={otp.length !== 6}>
        {t("resetPassword")}
      </Button>
      <Link href="/sign-in" className="text-center text-sm text-primary hover:underline">
        {t("backToSignIn")}
      </Link>
    </form>
  );
}
