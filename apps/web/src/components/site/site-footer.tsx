import { Mail, MessageCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { brand } from "@mufasa/config/brand";
import { Link } from "@/i18n/navigation";
import { whatsappLink } from "@/lib/billing-math";
import { Container } from "./section";
import { Logo } from "./mascot";

const EXPLORE = [
  { href: "/programs", key: "programs" },
  { href: "/pricing", key: "pricing" },
  { href: "/tutors", key: "tutors" },
  { href: "/faq", key: "faq" },
  { href: "/contact", key: "contact" },
] as const;

const LEGAL = [
  { href: "/legal/privacy", key: "privacy" },
  { href: "/legal/terms", key: "terms" },
  { href: "/legal/kvkk", key: "kvkk" },
  { href: "/legal/cookies", key: "cookies" },
] as const;

const linkCls = "text-sm text-muted transition-colors hover:text-text";

export async function SiteFooter({ whatsapp, email }: { whatsapp: string; email: string }) {
  const t = await getTranslations("public");
  const tSite = await getTranslations("site");
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-surface-2">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
            <Logo />
            <span>{brand.shortName}</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted">{t("footer.about")}</p>
        </div>

        <nav aria-label={t("footer.explore")}>
          <h2 className="text-sm font-semibold">{t("footer.explore")}</h2>
          <ul className="mt-3 space-y-2">
            {EXPLORE.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkCls}>
                  {t(`nav.${l.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold">{t("footer.support")}</h2>
          <ul className="mt-3 space-y-2">
            <li>
              <a href={whatsappLink(whatsapp, t("contact.whatsappMessage"))} target="_blank" rel="noopener noreferrer" className={`${linkCls} inline-flex items-center gap-2`}>
                <MessageCircle className="size-4" aria-hidden />
                {t("footer.whatsapp")}
              </a>
            </li>
            <li>
              <a href={`mailto:${email}`} className={`${linkCls} inline-flex items-center gap-2`}>
                <Mail className="size-4" aria-hidden />
                <span dir="ltr">{email}</span>
              </a>
            </li>
          </ul>
        </div>

        <nav aria-label={t("footer.legal")}>
          <h2 className="text-sm font-semibold">{t("footer.legal")}</h2>
          <ul className="mt-3 space-y-2">
            {LEGAL.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkCls}>
                  {t(`footer.${l.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
      <div className="border-t border-border py-5">
        <Container>
          <p className="text-sm text-muted">{tSite("footerRights", { year, name: brand.name })}</p>
        </Container>
      </div>
    </footer>
  );
}
