"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await authClient.forgetPassword.emailOtp({ email: email.trim() });
      if (res.error) return setError(t("genericError"));
      router.push(`/reset-password?email=${encodeURIComponent(email.trim())}`);
    } catch {
      setError(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label={t("email")} htmlFor="fp-email" error={error ?? undefined}>
        <Input id="fp-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Button type="submit" loading={busy}>
        {t("sendCode")}
      </Button>
      <Link href="/sign-in" className="text-center text-sm text-primary hover:underline">
        {t("backToSignIn")}
      </Link>
    </form>
  );
}
