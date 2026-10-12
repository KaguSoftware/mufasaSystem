import { Megaphone } from "lucide-react";
import { getLocale } from "next-intl/server";
import { isDbConfigured, type Role } from "@mufasa/db";
import { t18n } from "@mufasa/config/locales";
import { getActiveAnnouncements } from "@/server/dal/announcements";
import { Card } from "@/components/ui/card";

/**
 * Active announcements for a role (published, not expired, audience empty or including the role).
 * Server component: drop it into any dashboard. Renders nothing when there are none.
 */
export async function Announcements({ role, limit = 3 }: { role: Role; limit?: number }) {
  if (!isDbConfigured()) return null;
  const [locale, items] = await Promise.all([getLocale(), getActiveAnnouncements(role, limit)]);
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {items.map((a) => (
        <Card key={a.id} className="flex items-start gap-3 border-primary/30 bg-primary-soft/40 p-4">
          <Megaphone className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0 text-sm">
            <p className="font-medium">{t18n(a.title, locale)}</p>
            <p className="mt-0.5 whitespace-pre-line text-muted">{t18n(a.body, locale)}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
