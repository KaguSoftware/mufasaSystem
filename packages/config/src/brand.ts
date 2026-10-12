/**
 * Single source of truth for branding. The academy name, logo and contact
 * details are still TBD: change them here (and the design tokens in
 * apps/web/src/app/globals.css) and the whole app follows.
 */
export const brand = {
  name: "Academy",
  shortName: "Academy",
  tagline: {
    en: "Arabic & Quran for kids and teens",
    ar: "العربية والقرآن للأطفال واليافعين",
    tr: "Çocuklar ve gençler için Arapça ve Kur'an",
  },
  logo: "/brand/logo.svg",
  mascot: { name: "Mufasa", avatar: "/brand/mascot.svg" },
  supportEmail: "support@example.com",
  /** E.164 without "+", used for wa.me links. Overridable at runtime via settings table. */
  whatsappNumber: "905000000000",
  defaultCurrency: "TRY" as "TRY" | "USD" | "EUR",
  social: { instagram: "", youtube: "" },
} as const;

export type Brand = typeof brand;
