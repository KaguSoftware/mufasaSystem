"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

export function VerifyEmailForm({ email, next }: { email: string; next: string | null }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const destination = next ?? `/${locale}/dashboard`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await authClient.emailOtp.verifyEmail({ email, otp: code.trim() });
      if (res.error) return setError(t("invalidCode"));
      window.location.assign(destination);
    } catch {
      setError(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    const res = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
    if (res.error) toast.error(t("genericError"));
    else toast.success(t("codeSent"));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label={t("otpCode")} htmlFor="vf-code" error={error ?? undefined}>
        <Input
          id="vf-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          autoFocus
        />
      </Field>
      <Button type="submit" loading={busy} disabled={code.length !== 6 || !email}>
        {t("verify")}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <Button type="button" variant="link" onClick={resend} disabled={!email}>
          {t("resend")}
        </Button>
        <a href={destination} className="text-muted hover:underline">
          {t("skipForNow")}
        </a>
      </div>
    </form>
  );
}
