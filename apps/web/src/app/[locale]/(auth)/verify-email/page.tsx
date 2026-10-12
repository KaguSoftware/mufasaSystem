import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { safeNext } from "@/lib/safe-next";
import { VerifyEmailForm } from "./verify-email-form";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string; next?: string }> }) {
  const [t, sp] = await Promise.all([getTranslations("auth"), searchParams]);
  const email = sp.email ?? "";
  return (
    <AuthCard title={t("verifyEmailTitle")} subtitle={t("verifyEmailBody", { email })}>
      <VerifyEmailForm email={email} next={safeNext(sp.next)} />
    </AuthCard>
  );
}
