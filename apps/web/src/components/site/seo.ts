import type { Metadata } from "next";
import { brand } from "@mufasa/config/brand";
import { locales } from "@mufasa/config/locales";

/** Absolute site origin, from APP_URL (no trailing slash). Safe to call without env validation. */
export function siteOrigin(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

const OG_LOCALE: Record<string, string> = { en: "en_US", ar: "ar_AR", tr: "tr_TR" };

/** Localized metadata with canonical, hreflang alternates and Open Graph basics. `path` is locale-less ("" or "/pricing"). */
export function pageMetadata(opts: { locale: string; path: string; title?: string; description: string }): Metadata {
  const { locale, path, title, description } = opts;
  const url = `${siteOrigin()}/${locale}${path}`;
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = `${siteOrigin()}/${l}${path}`;
  languages["x-default"] = `${siteOrigin()}/en${path}`;
  const fullTitle = title ?? brand.name;
  return {
    metadataBase: new URL(siteOrigin()),
    title: title ? { absolute: `${title} · ${brand.name}` } : { absolute: brand.name },
    description,
    alternates: { canonical: url, languages },
    openGraph: {
      type: "website",
      siteName: brand.name,
      title: fullTitle,
      description,
      url,
      locale: OG_LOCALE[locale] ?? "en_US",
      alternateLocale: locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l] ?? "en_US"),
      images: [{ url: `${siteOrigin()}${brand.mascot.avatar}`, alt: brand.name }],
    },
    twitter: { card: "summary", title: fullTitle, description },
  };
}
