import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Noto_Naskh_Arabic, Rubik } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { brand } from "@mufasa/config/brand";
import { isRtl } from "@mufasa/config/locales";
import { asLocale, routing } from "@/i18n/routing";
import { Toaster } from "@/components/ui/toast";
import "../globals.css";

const rubik = Rubik({ subsets: ["latin", "latin-ext", "arabic"], variable: "--font-rubik", display: "swap" });
const naskh = Noto_Naskh_Arabic({ subsets: ["arabic"], variable: "--font-naskh", display: "swap" });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: "site" });
  return { title: { default: brand.name, template: `%s · ${brand.name}` }, description: t("heroSubtitle") };
}

/** Resolves saved theme before first paint to avoid a flash. */
const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`;

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${rubik.variable} ${naskh.variable} min-h-dvh`}>
        <NextIntlClientProvider>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
