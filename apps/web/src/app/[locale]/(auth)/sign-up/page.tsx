import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "./sign-up-form";

export default async function SignUpPage() {
  const t = await getTranslations("auth");
  return (
    <AuthCard title={t("signUpTitle")} subtitle={t("signUpSubtitle")}>
      <SignUpForm />
    </AuthCard>
  );
}
