import "server-only";
import { env } from "@/env";
import { escapeHtml } from "@/lib/digest";
import { sendEmail } from "../email";

const COPY = {
  en: {
    subject: "Your access is about to expire",
    body: (name: string, date: string) =>
      `Hello ${name},\n\nYour access expires on ${date}. Renew before then to keep learning without interruption.`,
    cta: "Renew",
  },
  ar: {
    subject: "اشتراكك على وشك الانتهاء",
    body: (name: string, date: string) =>
      `مرحبًا ${name}،\n\nينتهي اشتراكك في ${date}. جدّد قبل هذا التاريخ لتواصل التعلّم دون انقطاع.`,
    cta: "تجديد",
  },
  tr: {
    subject: "Erişiminizin süresi dolmak üzere",
    body: (name: string, date: string) =>
      `Merhaba ${name},\n\nErişiminiz ${date} tarihinde sona eriyor. Kesintisiz öğrenmeye devam etmek için o tarihten önce yenileyin.`,
    cta: "Yenile",
  },
} as const;

export async function sendExpiryReminderEmail(opts: { to: string; name: string; locale: string; date: string; role: string }) {
  const c = COPY[(opts.locale in COPY ? opts.locale : "en") as keyof typeof COPY];
  const href = `${env().APP_URL}/${opts.locale in COPY ? opts.locale : "en"}/${opts.role === "student" ? "student" : "parent"}/billing`;
  const text = `${c.body(opts.name, opts.date)}\n\n${c.cta}: ${href}`;
  const htmlBody = c.body(escapeHtml(opts.name), escapeHtml(opts.date)).replace(/\n\n/g, "</p><p>");
  const html = `<p>${htmlBody}</p><p><a href="${escapeHtml(href)}">${c.cta}</a></p>`;
  return sendEmail({ to: opts.to, subject: c.subject, html, text });
}
