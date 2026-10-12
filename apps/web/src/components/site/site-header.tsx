"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { brand } from "@mufasa/config/brand";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher, ThemeToggle } from "@/components/shell/switchers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, SheetContent } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { Container } from "./section";
import { Logo } from "./mascot";

const NAV = [
  { href: "/programs", key: "programs" },
  { href: "/pricing", key: "pricing" },
  { href: "/tutors", key: "tutors" },
  { href: "/faq", key: "faq" },
  { href: "/contact", key: "contact" },
] as const;

export function SiteHeader() {
  const t = useTranslations("public.nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <Container className="flex h-16 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold" aria-label={`${brand.name}: ${t("home")}`}>
          <Logo />
          <span>{brand.shortName}</span>
        </Link>

        <nav aria-label={t("mainNav")} className="ms-6 hidden items-center gap-1 lg:flex">
          {NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-2",
                  active ? "text-primary" : "text-muted hover:text-text",
                )}
              >
                {t(n.key)}
              </Link>
            );
          })}
        </nav>

        <div className="ms-auto flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
          <Button asChild variant="ghost" size="md" className="hidden sm:inline-flex">
            <Link href="/sign-in">{t("signIn")}</Link>
          </Button>
          <Button asChild size="md" className="hidden sm:inline-flex">
            <Link href="/sign-up">{t("getStarted")}</Link>
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("menu")}>
                <Menu className="size-5" />
              </Button>
            </DialogTrigger>
            <SheetContent title={t("menu")}>
              <nav aria-label={t("mainNav")} className="flex flex-col gap-1">
                {NAV.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-3 text-base font-medium hover:bg-surface-2"
                  >
                    {t(n.key)}
                  </Link>
                ))}
              </nav>
              <div className="mt-6 flex flex-col gap-2">
                <Button asChild size="lg" onClick={() => setOpen(false)}>
                  <Link href="/sign-up">{t("getStarted")}</Link>
                </Button>
                <Button asChild size="lg" variant="outline" onClick={() => setOpen(false)}>
                  <Link href="/sign-in">{t("signIn")}</Link>
                </Button>
              </div>
            </SheetContent>
          </Dialog>
        </div>
      </Container>
    </header>
  );
}
