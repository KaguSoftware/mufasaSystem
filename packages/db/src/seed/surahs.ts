import type { Db } from "../client";
import { quranSurahs } from "../schema";

type Row = [nameAr: string, nameEn: string, translit: string, ayahs: number];

/** Medinan surahs (Tanzil classification); every other surah is Meccan. */
const MEDINAN = new Set([2, 3, 4, 5, 8, 9, 13, 22, 24, 33, 47, 48, 49, 55, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 76, 98, 99, 110]);

const SURAHS: Row[] = [
  ["الفاتحة", "The Opening", "Al-Fatihah", 7],
  ["البقرة", "The Cow", "Al-Baqarah", 286],
  ["آل عمران", "The Family of Imran", "Ali 'Imran", 200],
  ["النساء", "The Women", "An-Nisa", 176],
  ["المائدة", "The Table Spread", "Al-Ma'idah", 120],
  ["الأنعام", "The Cattle", "Al-An'am", 165],
  ["الأعراف", "The Heights", "Al-A'raf", 206],
  ["الأنفال", "The Spoils of War", "Al-Anfal", 75],
  ["التوبة", "The Repentance", "At-Tawbah", 129],
  ["يونس", "Jonah", "Yunus", 109],
  ["هود", "Hud", "Hud", 123],
  ["يوسف", "Joseph", "Yusuf", 111],
  ["الرعد", "The Thunder", "Ar-Ra'd", 43],
  ["إبراهيم", "Abraham", "Ibrahim", 52],
  ["الحجر", "The Rocky Tract", "Al-Hijr", 99],
  ["النحل", "The Bee", "An-Nahl", 128],
  ["الإسراء", "The Night Journey", "Al-Isra", 111],
  ["الكهف", "The Cave", "Al-Kahf", 110],
  ["مريم", "Mary", "Maryam", 98],
  ["طه", "Ta-Ha", "Ta-Ha", 135],
  ["الأنبياء", "The Prophets", "Al-Anbiya", 112],
  ["الحج", "The Pilgrimage", "Al-Hajj", 78],
  ["المؤمنون", "The Believers", "Al-Mu'minun", 118],
  ["النور", "The Light", "An-Nur", 64],
  ["الفرقان", "The Criterion", "Al-Furqan", 77],
  ["الشعراء", "The Poets", "Ash-Shu'ara", 227],
  ["النمل", "The Ant", "An-Naml", 93],
  ["القصص", "The Stories", "Al-Qasas", 88],
  ["العنكبوت", "The Spider", "Al-'Ankabut", 69],
  ["الروم", "The Romans", "Ar-Rum", 60],
  ["لقمان", "Luqman", "Luqman", 34],
  ["السجدة", "The Prostration", "As-Sajdah", 30],
  ["الأحزاب", "The Combined Forces", "Al-Ahzab", 73],
  ["سبأ", "Sheba", "Saba", 54],
  ["فاطر", "The Originator", "Fatir", 45],
  ["يس", "Ya-Sin", "Ya-Sin", 83],
  ["الصافات", "Those Who Set the Ranks", "As-Saffat", 182],
  ["ص", "Sad", "Sad", 88],
  ["الزمر", "The Troops", "Az-Zumar", 75],
  ["غافر", "The Forgiver", "Ghafir", 85],
  ["فصلت", "Explained in Detail", "Fussilat", 54],
  ["الشورى", "The Consultation", "Ash-Shura", 53],
  ["الزخرف", "The Ornaments of Gold", "Az-Zukhruf", 89],
  ["الدخان", "The Smoke", "Ad-Dukhan", 59],
  ["الجاثية", "The Kneeling", "Al-Jathiyah", 37],
  ["الأحقاف", "The Wind-Curved Sandhills", "Al-Ahqaf", 35],
  ["محمد", "Muhammad", "Muhammad", 38],
  ["الفتح", "The Victory", "Al-Fath", 29],
  ["الحجرات", "The Rooms", "Al-Hujurat", 18],
  ["ق", "Qaf", "Qaf", 45],
  ["الذاريات", "The Winnowing Winds", "Adh-Dhariyat", 60],
  ["الطور", "The Mount", "At-Tur", 49],
  ["النجم", "The Star", "An-Najm", 62],
  ["القمر", "The Moon", "Al-Qamar", 55],
  ["الرحمن", "The Most Merciful", "Ar-Rahman", 78],
  ["الواقعة", "The Inevitable", "Al-Waqi'ah", 96],
  ["الحديد", "The Iron", "Al-Hadid", 29],
  ["المجادلة", "The Pleading Woman", "Al-Mujadila", 22],
  ["الحشر", "The Exile", "Al-Hashr", 24],
  ["الممتحنة", "She That Is to Be Examined", "Al-Mumtahanah", 13],
  ["الصف", "The Ranks", "As-Saff", 14],
  ["الجمعة", "The Congregation, Friday", "Al-Jumu'ah", 11],
  ["المنافقون", "The Hypocrites", "Al-Munafiqun", 11],
  ["التغابن", "The Mutual Disillusion", "At-Taghabun", 18],
  ["الطلاق", "The Divorce", "At-Talaq", 12],
  ["التحريم", "The Prohibition", "At-Tahrim", 12],
  ["الملك", "The Sovereignty", "Al-Mulk", 30],
  ["القلم", "The Pen", "Al-Qalam", 52],
  ["الحاقة", "The Reality", "Al-Haqqah", 52],
  ["المعارج", "The Ascending Stairways", "Al-Ma'arij", 44],
  ["نوح", "Noah", "Nuh", 28],
  ["الجن", "The Jinn", "Al-Jinn", 28],
  ["المزمل", "The Enshrouded One", "Al-Muzzammil", 20],
  ["المدثر", "The Cloaked One", "Al-Muddaththir", 56],
  ["القيامة", "The Resurrection", "Al-Qiyamah", 40],
  ["الإنسان", "The Human", "Al-Insan", 31],
  ["المرسلات", "The Emissaries", "Al-Mursalat", 50],
  ["النبأ", "The Tidings", "An-Naba", 40],
  ["النازعات", "Those Who Drag Forth", "An-Nazi'at", 46],
  ["عبس", "He Frowned", "'Abasa", 42],
  ["التكوير", "The Overturning", "At-Takwir", 29],
  ["الانفطار", "The Cleaving", "Al-Infitar", 19],
  ["المطففين", "The Defrauding", "Al-Mutaffifin", 36],
  ["الانشقاق", "The Sundering", "Al-Inshiqaq", 25],
  ["البروج", "The Mansions of the Stars", "Al-Buruj", 22],
  ["الطارق", "The Nightcomer", "At-Tariq", 17],
  ["الأعلى", "The Most High", "Al-A'la", 19],
  ["الغاشية", "The Overwhelming", "Al-Ghashiyah", 26],
  ["الفجر", "The Dawn", "Al-Fajr", 30],
  ["البلد", "The City", "Al-Balad", 20],
  ["الشمس", "The Sun", "Ash-Shams", 15],
  ["الليل", "The Night", "Al-Layl", 21],
  ["الضحى", "The Morning Hours", "Ad-Duha", 11],
  ["الشرح", "The Relief", "Ash-Sharh", 8],
  ["التين", "The Fig", "At-Tin", 8],
  ["العلق", "The Clot", "Al-'Alaq", 19],
  ["القدر", "The Power", "Al-Qadr", 5],
  ["البينة", "The Clear Proof", "Al-Bayyinah", 8],
  ["الزلزلة", "The Earthquake", "Az-Zalzalah", 8],
  ["العاديات", "The Courser", "Al-'Adiyat", 11],
  ["القارعة", "The Calamity", "Al-Qari'ah", 11],
  ["التكاثر", "Rivalry in World Increase", "At-Takathur", 8],
  ["العصر", "The Declining Day", "Al-'Asr", 3],
  ["الهمزة", "The Traducer", "Al-Humazah", 9],
  ["الفيل", "The Elephant", "Al-Fil", 5],
  ["قريش", "Quraysh", "Quraysh", 4],
  ["الماعون", "Small Kindnesses", "Al-Ma'un", 7],
  ["الكوثر", "Abundance", "Al-Kawthar", 3],
  ["الكافرون", "The Disbelievers", "Al-Kafirun", 6],
  ["النصر", "Divine Support", "An-Nasr", 3],
  ["المسد", "The Palm Fiber", "Al-Masad", 5],
  ["الإخلاص", "Sincerity", "Al-Ikhlas", 4],
  ["الفلق", "The Daybreak", "Al-Falaq", 5],
  ["الناس", "Mankind", "An-Nas", 6],
];

const TOTAL_AYAHS = 6236;

/** Idempotent: upserts all 114 surahs by number. */
export async function seedSurahs(db: Db) {
  const total = SURAHS.reduce((sum, s) => sum + s[3], 0);
  if (SURAHS.length !== 114 || total !== TOTAL_AYAHS) {
    throw new Error(`Surah data is wrong: ${SURAHS.length} surahs, ${total} ayahs (expected 114 and ${TOTAL_AYAHS}).`);
  }
  const rows = SURAHS.map(([nameAr, nameEn, nameTranslit, ayahCount], i) => ({
    number: i + 1,
    nameAr,
    nameEn,
    nameTranslit,
    ayahCount,
    revelation: MEDINAN.has(i + 1) ? ("medinan" as const) : ("meccan" as const),
  }));
  for (const r of rows) {
    await db
      .insert(quranSurahs)
      .values(r)
      .onConflictDoUpdate({
        target: quranSurahs.number,
        set: { nameAr: r.nameAr, nameEn: r.nameEn, nameTranslit: r.nameTranslit, ayahCount: r.ayahCount, revelation: r.revelation },
      });
  }
  console.log(`  surahs: ${rows.length} (${total} ayahs)`);
}
