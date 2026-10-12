import type { Locale } from "@mufasa/config/locales";
import type { Messages } from "./en";

export const loaders: Record<Locale, () => Promise<{ default: Messages }>> = {
  en: () => import("./en"),
  ar: () => import("./ar"),
  tr: () => import("./tr"),
};

export type { Messages };
