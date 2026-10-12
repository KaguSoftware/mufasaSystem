"use client";

import { Check, Languages, Monitor, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { locales } from "@mufasa/config/locales";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LOCALE_LABELS: Record<string, string> = { en: "English", ar: "العربية", tr: "Türkçe" };

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-md p-2 text-muted outline-none transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-50"
        aria-label={t("language")}
        disabled={pending}
      >
        <Languages className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-40">
        {locales.map((l) => (
          <DropdownMenuItem key={l} onSelect={() => start(() => router.replace(pathname, { locale: l }))}>
            <span className="flex-1">{LOCALE_LABELS[l]}</span>
            {l === locale && <Check className="text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type ThemePref = "light" | "dark" | "system";

function applyTheme(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function ThemeToggle() {
  const t = useTranslations("common");
  const [pref, setPref] = useState<ThemePref>("system");

  useEffect(() => {
    // Sync from storage after mount (the pre-paint script already applied it).
    const saved = (localStorage.getItem("theme") as ThemePref | null) ?? "system";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPref(saved);
  }, []);

  function choose(p: ThemePref) {
    setPref(p);
    localStorage.setItem("theme", p);
    applyTheme(p);
  }

  const Icon = pref === "dark" ? Moon : pref === "light" ? Sun : Monitor;
  const opts: { v: ThemePref; label: string; icon: typeof Sun }[] = [
    { v: "light", label: t("themeLight"), icon: Sun },
    { v: "dark", label: t("themeDark"), icon: Moon },
    { v: "system", label: t("themeSystem"), icon: Monitor },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-md p-2 text-muted outline-none transition-colors hover:bg-surface-2 hover:text-text"
        aria-label={t("theme")}
      >
        <Icon className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-40">
        {opts.map((o) => (
          <DropdownMenuItem key={o.v} onSelect={() => choose(o.v)}>
            <o.icon />
            <span className="flex-1">{o.label}</span>
            {pref === o.v && <Check className="text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
