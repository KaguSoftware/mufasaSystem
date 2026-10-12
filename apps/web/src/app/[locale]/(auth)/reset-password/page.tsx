import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const [t, sp] = await Promise.all([getTranslations("auth"), searchParams]);
  return (
    <AuthCard title={t("resetPassword")} subtitle={t("resetSubtitle")}>
      <ResetPasswordForm initialEmail={sp.email ?? ""} />
    </AuthCard>
  );
}
