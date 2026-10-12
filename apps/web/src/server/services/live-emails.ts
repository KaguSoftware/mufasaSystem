import "server-only";
import { env } from "@/env";
import { sendEmail } from "../email";

const COPY = {
  en: {
    subject: (title: string) => `Reminder: "${title}" starts soon`,
    body: (who: string, title: string, when: string) =>
      `Hello ${who},\n\nA live class is coming up: "${title}" on ${when}.\n\nPlease be ready a few minutes early.`,
    cta: "Open classes",
  },
  ar: {
    subject: (title: string) => `تذكير: تبدأ حصة «${title}» قريبًا`,
    body: (who: string, title: string, when: string) =>
      `مرحبًا ${who}،\n\nلديكم حصة مباشرة قادمة: «${title}» في ${when}.\n\nنرجو الاستعداد قبل الموعد ببضع دقائق.`,
    cta: "فتح الحصص",
  },
  tr: {
    subject: (title: string) => `Hatırlatma: "${title}" birazdan başlıyor`,
    body: (who: string, title: string, when: string) =>
      `Merhaba ${who},\n\nYaklaşan bir canlı ders var: "${title}", ${when}.\n\nLütfen birkaç dakika önceden hazır olun.`,
    cta: "Dersleri aç",
  },
} as const;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function sendClassReminderEmail(opts: {
  to: string;
  name: string;
  locale: string;
  title: string;
  when: string;
  role: string;
}) {
  const locale = (opts.locale in COPY ? opts.locale : "en") as keyof typeof COPY;
  const c = COPY[locale];
  const path = opts.role === "student" ? "student/classes" : "parent/bookings";
  const href = `${env().APP_URL}/${locale}/${path}`;
  const body = c.body(opts.name, opts.title, opts.when);
  const text = `${body}\n\n${c.cta}: ${href}`;
  const html = `<p>${esc(body).replace(/\n\n/g, "</p><p>")}</p><p><a href="${href}">${c.cta}</a></p>`;
  return sendEmail({ to: opts.to, subject: c.subject(opts.title), html, text });
}
