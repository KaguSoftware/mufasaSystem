import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "@mufasa/config/locales";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];

/** Narrow a route param to a supported locale (falls back to default). */
export function asLocale(value: string): AppLocale {
  return (routing.locales as readonly string[]).includes(value) ? (value as AppLocale) : routing.defaultLocale;
}
