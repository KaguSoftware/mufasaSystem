import { setRequestLocale } from "next-intl/server";
import { asLocale } from "@/i18n/routing";
import { UiShowcase } from "./showcase";

/**
 * Living style guide for the UI kit (/en/ui, /ar/ui for RTL).
 * Majed: restyle components in src/components/ui and check them here.
 */
export default async function UiPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(asLocale(locale));
  return <UiShowcase />;
}
