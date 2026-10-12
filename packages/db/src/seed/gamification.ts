import type { Db } from "../client";
import { badges, type BadgeRule } from "../schema";

type BadgeSeed = {
  slug: string;
  icon: string;
  rule: BadgeRule;
  name: { en: string; ar: string; tr: string };
  description: { en: string; ar: string; tr: string };
};

const BADGES: BadgeSeed[] = [
  {
    slug: "first-lesson",
    icon: "star",
    rule: { type: "count", reason: "lesson_completed", count: 1 },
    name: { en: "First Step", ar: "الخطوة الأولى", tr: "İlk Adım" },
    description: { en: "Complete your first lesson.", ar: "أكمل أول درس لك.", tr: "İlk dersini tamamla." },
  },
  {
    slug: "streak-3",
    icon: "flame",
    rule: { type: "streak", days: 3 },
    name: { en: "3 Day Streak", ar: "سلسلة 3 أيام", tr: "3 Günlük Seri" },
    description: { en: "Learn three days in a row.", ar: "تعلّم ثلاثة أيام متتالية.", tr: "Üç gün üst üste öğren." },
  },
  {
    slug: "streak-7",
    icon: "flame",
    rule: { type: "streak", days: 7 },
    name: { en: "Week Warrior", ar: "بطل الأسبوع", tr: "Haftanın Kahramanı" },
    description: { en: "Learn seven days in a row.", ar: "تعلّم سبعة أيام متتالية.", tr: "Yedi gün üst üste öğren." },
  },
  {
    slug: "streak-30",
    icon: "trophy",
    rule: { type: "streak", days: 30 },
    name: { en: "Unstoppable", ar: "لا يوقفني شيء", tr: "Durdurulamaz" },
    description: { en: "Learn thirty days in a row.", ar: "تعلّم ثلاثين يومًا متتالية.", tr: "Otuz gün üst üste öğren." },
  },
  {
    slug: "xp-100",
    icon: "zap",
    rule: { type: "total_xp", amount: 100 },
    name: { en: "100 XP", ar: "100 نقطة خبرة", tr: "100 XP" },
    description: { en: "Earn 100 XP.", ar: "اجمع 100 نقطة خبرة.", tr: "100 XP kazan." },
  },
  {
    slug: "xp-1000",
    icon: "medal",
    rule: { type: "total_xp", amount: 1000 },
    name: { en: "1000 XP", ar: "1000 نقطة خبرة", tr: "1000 XP" },
    description: { en: "Earn 1000 XP.", ar: "اجمع 1000 نقطة خبرة.", tr: "1000 XP kazan." },
  },
  {
    slug: "first-course",
    icon: "graduation",
    rule: { type: "course_completed" },
    name: { en: "Course Complete", ar: "أتممت دورة", tr: "Kurs Tamamlandı" },
    description: { en: "Finish your first course.", ar: "أنهِ أول دورة لك.", tr: "İlk kursunu bitir." },
  },
  {
    slug: "ten-lessons",
    icon: "book",
    rule: { type: "count", reason: "lesson_completed", count: 10 },
    name: { en: "Bookworm", ar: "محبّ العلم", tr: "Kitap Kurdu" },
    description: { en: "Complete ten lessons.", ar: "أكمل عشرة دروس.", tr: "On ders tamamla." },
  },
];

/** Idempotent: upserts by slug. */
export async function seedGamification(db: Db) {
  for (const b of BADGES) {
    await db
      .insert(badges)
      .values({ slug: b.slug, icon: b.icon, rule: b.rule, name: b.name, description: b.description, active: true })
      .onConflictDoUpdate({
        target: badges.slug,
        set: { icon: b.icon, rule: b.rule, name: b.name, description: b.description },
      });
  }
  console.log(`  badges: ${BADGES.length}`);
}
