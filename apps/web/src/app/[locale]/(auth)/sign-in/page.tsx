import { getTranslations } from "next-intl/server";
import { isConfigured } from "@/env";
import { AuthCard } from "@/components/auth/auth-card";
import { safeNext } from "@/lib/safe-next";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [t, sp] = await Promise.all([getTranslations("auth"), searchParams]);
  return (
    <AuthCard title={t("signInTitle")} subtitle={t("signInSubtitle")}>
      <SignInForm googleEnabled={isConfigured("google")} next={safeNext(sp.next)} />
    </AuthCard>
  );
}
