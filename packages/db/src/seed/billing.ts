import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { plans, settings } from "../schema";

/** Idempotent: plans are upserted by slug, settings only inserted when missing. */
export async function seedBilling(db: Db) {
  const rows = [
    {
      slug: "monthly",
      name: { en: "Monthly", ar: "شهري", tr: "Aylık" },
      description: {
        en: "One learner, billed every month.",
        ar: "متعلّم واحد، يُجدَّد كل شهر.",
        tr: "Tek öğrenci, her ay yenilenir.",
      },
      priceMinor: 99900,
      interval: "month" as const,
      periodDays: 30,
      seats: 1,
      liveClassesPerMonth: 4,
      features: ["All courses", "Live classes", "Progress reports"],
      sortOrder: 1,
    },
    {
      slug: "quarterly",
      name: { en: "Quarterly", ar: "ربع سنوي", tr: "3 Aylık" },
      description: {
        en: "One learner, three months at a lower monthly price.",
        ar: "متعلّم واحد لثلاثة أشهر بسعر شهري أقل.",
        tr: "Tek öğrenci, üç ay boyunca daha düşük aylık fiyat.",
      },
      priceMinor: 249900,
      interval: "quarter" as const,
      periodDays: 90,
      seats: 1,
      liveClassesPerMonth: 4,
      features: ["All courses", "Live classes", "Progress reports", "Save 17 percent"],
      sortOrder: 2,
    },
    {
      slug: "family-yearly",
      name: { en: "Family yearly (3 children)", ar: "عائلي سنوي (3 أبناء)", tr: "Aile yıllık (3 çocuk)" },
      description: {
        en: "Up to three children for a full year.",
        ar: "حتى ثلاثة أبناء لمدة سنة كاملة.",
        tr: "Bir yıl boyunca en fazla üç çocuk.",
      },
      priceMinor: 799900,
      interval: "year" as const,
      periodDays: 365,
      seats: 3,
      liveClassesPerMonth: 8,
      features: ["All courses", "Up to 3 children", "Live classes", "Progress reports", "Best value"],
      sortOrder: 3,
    },
  ];
  for (const r of rows) {
    const existing = await db.query.plans.findFirst({ where: eq(plans.slug, r.slug), columns: { id: true } });
    if (existing) await db.update(plans).set(r).where(eq(plans.id, existing.id));
    else await db.insert(plans).values({ ...r, currency: "TRY", programIds: [], active: true });
  }

  const defaults: Record<string, unknown> = {
    "payment.iban": "",
    "payment.accountName": "",
    "payment.bankName": "",
    "payment.instructions": {
      en: "Transfer the exact amount and put the reference code in the transfer description. Then send us the receipt on WhatsApp.",
      ar: "حوّل المبلغ المطلوب بالضبط واكتب رمز المرجع في وصف التحويل، ثم أرسل لنا الإيصال عبر واتساب.",
      tr: "Tutarı aynen havale edin ve açıklamaya referans kodunu yazın. Ardından dekontu WhatsApp ile bize gönderin.",
    },
    "contact.whatsapp": "",
    "contact.email": "",
    "billing.reminderDaysBefore": 3,
  };
  for (const [key, value] of Object.entries(defaults)) {
    await db.insert(settings).values({ key, value }).onConflictDoNothing();
  }
}
