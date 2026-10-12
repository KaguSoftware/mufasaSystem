export const locales = ["en", "ar", "tr"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const rtlLocales: readonly Locale[] = ["ar"];
export const isRtl = (l: string) => (rtlLocales as readonly string[]).includes(l);

/** Translatable text stored in JSONB columns. `en` is required as the fallback. */
export type I18nText = { en: string; ar?: string; tr?: string };
export function t18n(value: I18nText | null | undefined, locale: string): string {
  if (!value) return "";
  return (value as Record<string, string | undefined>)[locale] || value.en;
}
