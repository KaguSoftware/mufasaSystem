import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import {
  courses,
  lessons,
  placementRules,
  programs,
  quizQuestions,
  quizzes,
  units,
  type LessonContext,
  type LessonType,
  type QuestionOption,
  type QuestionType,
} from "../schema";

type T = { en: string; ar: string; tr: string };

// ───────────── Programs ─────────────

const PROGRAMS = [
  {
    slug: "quran",
    name: { en: "Quran", ar: "القرآن الكريم", tr: "Kuran-ı Kerim" },
    description: {
      en: "Recite, understand and memorize the Quran with caring tutors.",
      ar: "تلاوة القرآن وفهمه وحفظه مع معلّمين متميزين.",
      tr: "Özenli öğretmenlerle Kuran'ı oku, anla ve ezberle.",
    },
    icon: "book",
    color: "#1f8a70",
    features: { hifz: true, recitation: true, liveClasses: true },
    sortOrder: 1,
  },
  {
    slug: "arabic",
    name: { en: "Arabic Language", ar: "اللغة العربية", tr: "Arapça" },
    description: {
      en: "From the alphabet to confident reading and conversation.",
      ar: "من الحروف الأبجدية إلى القراءة والمحادثة بثقة.",
      tr: "Alfabeden özgüvenli okuma ve konuşmaya.",
    },
    icon: "languages",
    color: "#c47f17",
    features: { liveClasses: true, placement: true },
    sortOrder: 2,
  },
];

// ───────────── Courses ─────────────

type LessonSeed = {
  slug: string;
  type: LessonType;
  title: T;
  summary: T;
  body?: T;
  durationSec?: number;
  isPreview?: boolean;
  context?: LessonContext;
  /** When set, a quiz is attached to this lesson. */
  quiz?: { title: T; questions: QuestionSeed[] };
};
type UnitSeed = { title: T; lessons: LessonSeed[] };
type CourseSeed = {
  programSlug: string;
  slug: string;
  title: T;
  description: T;
  level: "beginner" | "elementary" | "intermediate" | "advanced";
  ageMin: number;
  ageMax: number;
  units: UnitSeed[];
};

type QuestionSeed = {
  type: QuestionType;
  prompt: T;
  options?: { id: string; label: T }[];
  answer: string[];
  explanation?: T;
  skill?: string;
  difficulty?: number;
};

const TRUE_FALSE: { id: string; label: T }[] = [
  { id: "true", label: { en: "True", ar: "صحيح", tr: "Doğru" } },
  { id: "false", label: { en: "False", ar: "خطأ", tr: "Yanlış" } },
];

const COURSES: CourseSeed[] = [
  {
    programSlug: "quran",
    slug: "quran-for-beginners",
    title: { en: "Quran for Beginners", ar: "القرآن للمبتدئين", tr: "Yeni Başlayanlar için Kuran" },
    description: {
      en: "Learn to recite the short surahs with correct pronunciation, step by step.",
      ar: "تعلّم تلاوة السور القصيرة بنطق صحيح خطوة بخطوة.",
      tr: "Kısa sureleri doğru telaffuzla adım adım okumayı öğren.",
    },
    level: "beginner",
    ageMin: 6,
    ageMax: 14,
    units: [
      {
        title: { en: "Short Surahs", ar: "السور القصيرة", tr: "Kısa Sureler" },
        lessons: [
          {
            slug: "surah-al-fatihah",
            type: "video",
            isPreview: true,
            durationSec: 420,
            title: { en: "Surah Al-Fatihah", ar: "سورة الفاتحة", tr: "Fatiha Suresi" },
            summary: {
              en: "Listen to and repeat the opening chapter of the Quran.",
              ar: "استمع إلى فاتحة الكتاب وكرّرها.",
              tr: "Kuran'ın açılış suresini dinle ve tekrar et.",
            },
            body: {
              en: "## Today\n\nWe learn **Surah Al-Fatihah**, the opening of the Quran.\n\n- Listen carefully\n- Repeat after the teacher\n- Try to read it by yourself",
              ar: "## اليوم\n\nنتعلّم **سورة الفاتحة**، فاتحة القرآن الكريم.\n\n- استمع جيدًا\n- كرّر بعد المعلّم\n- حاول أن تقرأها وحدك",
              tr: "## Bugün\n\n**Fatiha Suresi**'ni öğreniyoruz, Kuran'ın açılışı.\n\n- Dikkatle dinle\n- Öğretmenden sonra tekrar et\n- Kendin okumayı dene",
            },
            context: {
              objectives: ["Recite Al-Fatihah with correct pronunciation", "Know that it has seven ayahs"],
              approach: "Short phrases, repeat after the teacher, then read the whole surah together.",
              vocabulary: [
                { term: "Rabb", meaning: "Lord" },
                { term: "Rahman", meaning: "The Most Merciful" },
              ],
              ayahRefs: [{ surah: 1, from: 1, to: 7 }],
              notes: "Keep the tone warm. Praise every attempt.",
            },
          },
          {
            slug: "surah-al-ikhlas",
            type: "video",
            durationSec: 300,
            title: { en: "Surah Al-Ikhlas", ar: "سورة الإخلاص", tr: "İhlas Suresi" },
            summary: {
              en: "A short surah about the oneness of Allah.",
              ar: "سورة قصيرة عن وحدانية الله.",
              tr: "Allah'ın birliği hakkında kısa bir sure.",
            },
            context: {
              objectives: ["Recite Al-Ikhlas", "Explain in one sentence what it teaches"],
              ayahRefs: [{ surah: 112, from: 1, to: 4 }],
            },
          },
          {
            slug: "quiz-short-surahs",
            type: "quiz",
            title: { en: "Quiz: Short Surahs", ar: "اختبار: السور القصيرة", tr: "Sınav: Kısa Sureler" },
            summary: {
              en: "Check what you learned in this unit.",
              ar: "اختبر ما تعلمته في هذه الوحدة.",
              tr: "Bu ünitede öğrendiklerini kontrol et.",
            },
            quiz: {
              title: { en: "Short Surahs quiz", ar: "اختبار السور القصيرة", tr: "Kısa Sureler sınavı" },
              questions: [
                {
                  type: "single",
                  prompt: {
                    en: "How many ayahs does Surah Al-Fatihah have?",
                    ar: "كم عدد آيات سورة الفاتحة؟",
                    tr: "Fatiha Suresi kaç ayettir?",
                  },
                  options: [
                    { id: "a", label: { en: "5", ar: "5", tr: "5" } },
                    { id: "b", label: { en: "7", ar: "7", tr: "7" } },
                    { id: "c", label: { en: "10", ar: "10", tr: "10" } },
                  ],
                  answer: ["b"],
                  skill: "knowledge",
                },
                {
                  type: "true_false",
                  prompt: {
                    en: "Surah Al-Ikhlas is about the oneness of Allah.",
                    ar: "سورة الإخلاص عن وحدانية الله.",
                    tr: "İhlas Suresi Allah'ın birliğini anlatır.",
                  },
                  options: TRUE_FALSE,
                  answer: ["true"],
                  skill: "knowledge",
                },
                {
                  type: "text",
                  prompt: {
                    en: "Type the Arabic name of the first surah of the Quran.",
                    ar: "اكتب اسم أول سورة في القرآن.",
                    tr: "Kuran'ın ilk suresinin Arapça adını yaz.",
                  },
                  answer: ["الفاتحة", "سورة الفاتحة", "Al-Fatihah", "Fatiha"],
                  skill: "knowledge",
                  difficulty: 2,
                },
              ],
            },
          },
        ],
      },
      {
        title: { en: "Recitation Manners", ar: "آداب التلاوة", tr: "Okuma Adabı" },
        lessons: [
          {
            slug: "manners-of-recitation",
            type: "reading",
            title: { en: "Manners of Recitation", ar: "آداب التلاوة", tr: "Okuma Adabı" },
            summary: {
              en: "How we prepare to read the Quran.",
              ar: "كيف نستعد لقراءة القرآن.",
              tr: "Kuran okumaya nasıl hazırlanırız.",
            },
            body: {
              en: "## Before you read\n\n1. Wash your hands and sit calmly.\n2. Say **Bismillah**.\n3. Read slowly and clearly.\n\nTake your time, there is no rush.",
              ar: "## قبل القراءة\n\n1. اغسل يديك واجلس بهدوء.\n2. قل **بسم الله**.\n3. اقرأ ببطء ووضوح.\n\nخذ وقتك، لا داعي للعجلة.",
              tr: "## Okumadan önce\n\n1. Ellerini yıka ve sakince otur.\n2. **Bismillah** de.\n3. Yavaş ve net oku.\n\nAcele etme, zamanın var.",
            },
          },
          {
            slug: "surah-an-nas",
            type: "video",
            durationSec: 280,
            title: { en: "Surah An-Nas", ar: "سورة الناس", tr: "Nas Suresi" },
            summary: {
              en: "The last surah of the Quran.",
              ar: "آخر سور القرآن الكريم.",
              tr: "Kuran'ın son suresi.",
            },
            context: { ayahRefs: [{ surah: 114, from: 1, to: 6 }], objectives: ["Recite An-Nas"] },
          },
          {
            slug: "quiz-recitation-manners",
            type: "quiz",
            title: { en: "Quiz: Recitation Manners", ar: "اختبار: آداب التلاوة", tr: "Sınav: Okuma Adabı" },
            summary: { en: "A quick check.", ar: "اختبار سريع.", tr: "Hızlı bir kontrol." },
            quiz: {
              title: { en: "Recitation manners quiz", ar: "اختبار آداب التلاوة", tr: "Okuma adabı sınavı" },
              questions: [
                {
                  type: "single",
                  prompt: {
                    en: "What do we say before we start reading?",
                    ar: "ماذا نقول قبل أن نبدأ القراءة؟",
                    tr: "Okumaya başlamadan önce ne deriz?",
                  },
                  options: [
                    { id: "a", label: { en: "Bismillah", ar: "بسم الله", tr: "Bismillah" } },
                    { id: "b", label: { en: "Goodbye", ar: "مع السلامة", tr: "Hoşça kal" } },
                    { id: "c", label: { en: "Nothing", ar: "لا شيء", tr: "Hiçbir şey" } },
                  ],
                  answer: ["a"],
                },
                {
                  type: "true_false",
                  prompt: {
                    en: "We should read quickly without caring about the words.",
                    ar: "ينبغي أن نقرأ بسرعة دون الاهتمام بالكلمات.",
                    tr: "Kelimelere aldırmadan hızlı okumalıyız.",
                  },
                  options: TRUE_FALSE,
                  answer: ["false"],
                },
                {
                  type: "multiple",
                  prompt: {
                    en: "Which of these are good manners before reading? Choose all that apply.",
                    ar: "أي مما يلي من آداب القراءة؟ اختر كل ما ينطبق.",
                    tr: "Bunlardan hangileri okumadan önceki güzel adaplardır? Uygun olanların hepsini seç.",
                  },
                  options: [
                    { id: "a", label: { en: "Sit calmly", ar: "الجلوس بهدوء", tr: "Sakince oturmak" } },
                    { id: "b", label: { en: "Wash your hands", ar: "غسل اليدين", tr: "Elleri yıkamak" } },
                    { id: "c", label: { en: "Play loudly", ar: "اللعب بصوت عالٍ", tr: "Yüksek sesle oynamak" } },
                  ],
                  answer: ["a", "b"],
                  difficulty: 2,
                },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    programSlug: "arabic",
    slug: "arabic-alphabet",
    title: { en: "Arabic Alphabet", ar: "الحروف العربية", tr: "Arapça Alfabe" },
    description: {
      en: "Learn the letters, their sounds and how to read simple words.",
      ar: "تعلّم الحروف وأصواتها وكيف تقرأ كلمات بسيطة.",
      tr: "Harfleri, seslerini ve basit kelimelerin nasıl okunacağını öğren.",
    },
    level: "beginner",
    ageMin: 5,
    ageMax: 12,
    units: [
      {
        title: { en: "The Letters", ar: "الحروف", tr: "Harfler" },
        lessons: [
          {
            slug: "first-letters",
            type: "video",
            isPreview: true,
            durationSec: 360,
            title: { en: "The First Letters", ar: "الحروف الأولى", tr: "İlk Harfler" },
            summary: {
              en: "Meet Alif, Ba and Ta.",
              ar: "تعرّف على الألف والباء والتاء.",
              tr: "Elif, Ba ve Ta ile tanış.",
            },
            context: {
              objectives: ["Recognize Alif, Ba and Ta", "Say each letter's sound"],
              approach: "Show the letter, say the sound, then use a picture word.",
              vocabulary: [
                { term: "أرنب", meaning: "rabbit" },
                { term: "باب", meaning: "door" },
              ],
            },
          },
          {
            slug: "letter-shapes",
            type: "reading",
            title: { en: "Letter Shapes", ar: "أشكال الحروف", tr: "Harf Şekilleri" },
            summary: {
              en: "Letters change shape inside a word.",
              ar: "تتغير أشكال الحروف داخل الكلمة.",
              tr: "Harfler kelimenin içinde şekil değiştirir.",
            },
            body: {
              en: "## Shapes\n\nEach Arabic letter can look different at the **start**, **middle** or **end** of a word.\n\n- Start: ب\n- Middle: ـبـ\n- End: ـب",
              ar: "## الأشكال\n\nلكل حرف عربي شكل مختلف في **أول** الكلمة و**وسطها** و**آخرها**.\n\n- أول الكلمة: بـ\n- وسط الكلمة: ـبـ\n- آخر الكلمة: ـب",
              tr: "## Şekiller\n\nHer Arapça harf kelimenin **başında**, **ortasında** ve **sonunda** farklı görünebilir.\n\n- Baş: بـ\n- Orta: ـبـ\n- Son: ـب",
            },
          },
          {
            slug: "quiz-the-letters",
            type: "quiz",
            title: { en: "Quiz: The Letters", ar: "اختبار: الحروف", tr: "Sınav: Harfler" },
            summary: { en: "Test your letters.", ar: "اختبر معرفتك بالحروف.", tr: "Harf bilgini sına." },
            quiz: {
              title: { en: "Letters quiz", ar: "اختبار الحروف", tr: "Harfler sınavı" },
              questions: [
                {
                  type: "single",
                  prompt: {
                    en: "Which letter is Ba?",
                    ar: "أي هذه الحروف هو حرف الباء؟",
                    tr: "Hangi harf Ba'dır?",
                  },
                  options: [
                    { id: "a", label: { en: "ب", ar: "ب", tr: "ب" } },
                    { id: "b", label: { en: "ت", ar: "ت", tr: "ت" } },
                    { id: "c", label: { en: "ن", ar: "ن", tr: "ن" } },
                  ],
                  answer: ["a"],
                  skill: "letters",
                },
                {
                  type: "true_false",
                  prompt: {
                    en: "Arabic is written from right to left.",
                    ar: "تُكتب العربية من اليمين إلى اليسار.",
                    tr: "Arapça sağdan sola yazılır.",
                  },
                  options: TRUE_FALSE,
                  answer: ["true"],
                  skill: "letters",
                },
                {
                  type: "match",
                  prompt: {
                    en: "Match each letter with its name.",
                    ar: "طابق كل حرف باسمه.",
                    tr: "Her harfi adıyla eşleştir.",
                  },
                  options: [
                    { id: "l-1", label: { en: "ا", ar: "ا", tr: "ا" } },
                    { id: "l-2", label: { en: "ب", ar: "ب", tr: "ب" } },
                    { id: "r-1", label: { en: "Alif", ar: "ألف", tr: "Elif" } },
                    { id: "r-2", label: { en: "Ba", ar: "باء", tr: "Ba" } },
                  ],
                  answer: ["l-1:r-1", "l-2:r-2"],
                  skill: "letters",
                  difficulty: 2,
                },
              ],
            },
          },
        ],
      },
      {
        title: { en: "Short Vowels", ar: "الحركات", tr: "Harekeler" },
        lessons: [
          {
            slug: "fatha-damma-kasra",
            type: "video",
            durationSec: 330,
            title: { en: "Fatha, Damma and Kasra", ar: "الفتحة والضمة والكسرة", tr: "Fetha, Damme ve Kesre" },
            summary: {
              en: "The three short vowels.",
              ar: "الحركات الثلاث القصيرة.",
              tr: "Üç kısa ünlü.",
            },
            context: { objectives: ["Read a letter with each short vowel"] },
          },
          {
            slug: "reading-simple-words",
            type: "reading",
            title: { en: "Reading Simple Words", ar: "قراءة كلمات بسيطة", tr: "Basit Kelimeleri Okuma" },
            summary: {
              en: "Put letters and vowels together.",
              ar: "اجمع الحروف مع الحركات.",
              tr: "Harfleri ve harekeleri birleştir.",
            },
            body: {
              en: "## Let us read\n\nبَ + ا + بٌ = **بابٌ** (door)\n\nSound out each part, then say the whole word.",
              ar: "## هيا نقرأ\n\nبَ + ا + بٌ = **بابٌ**\n\nانطق كل جزء ثم انطق الكلمة كاملة.",
              tr: "## Hadi okuyalım\n\nبَ + ا + بٌ = **بابٌ** (kapı)\n\nHer parçayı seslendir, sonra kelimenin tamamını söyle.",
            },
          },
          {
            slug: "quiz-short-vowels",
            type: "quiz",
            title: { en: "Quiz: Short Vowels", ar: "اختبار: الحركات", tr: "Sınav: Harekeler" },
            summary: { en: "Check the vowels.", ar: "اختبر الحركات.", tr: "Harekeleri kontrol et." },
            quiz: {
              title: { en: "Short vowels quiz", ar: "اختبار الحركات", tr: "Harekeler sınavı" },
              questions: [
                {
                  type: "single",
                  prompt: {
                    en: "How many short vowels did we learn?",
                    ar: "كم حركة قصيرة تعلّمنا؟",
                    tr: "Kaç kısa ünlü öğrendik?",
                  },
                  options: [
                    { id: "a", label: { en: "Two", ar: "اثنتان", tr: "İki" } },
                    { id: "b", label: { en: "Three", ar: "ثلاث", tr: "Üç" } },
                    { id: "c", label: { en: "Four", ar: "أربع", tr: "Dört" } },
                  ],
                  answer: ["b"],
                  skill: "reading",
                },
                {
                  type: "order",
                  prompt: {
                    en: "Put the parts of the word بابٌ in the order we say them.",
                    ar: "رتّب أجزاء كلمة «بابٌ» كما تُنطق.",
                    tr: "بابٌ kelimesinin parçalarını söylenme sırasına koy.",
                  },
                  options: [
                    { id: "a", label: { en: "بَ", ar: "بَ", tr: "بَ" } },
                    { id: "b", label: { en: "ا", ar: "ا", tr: "ا" } },
                    { id: "c", label: { en: "بٌ", ar: "بٌ", tr: "بٌ" } },
                  ],
                  answer: ["a", "b", "c"],
                  skill: "reading",
                  difficulty: 2,
                },
              ],
            },
          },
        ],
      },
    ],
  },
];

// ───────────── Placement quiz ─────────────

const PLACEMENT_TITLE: T = { en: "Arabic placement test", ar: "اختبار تحديد مستوى العربية", tr: "Arapça seviye belirleme sınavı" };

const PLACEMENT_QUESTIONS: QuestionSeed[] = [
  {
    type: "single",
    skill: "letters",
    prompt: { en: "Which of these letters is Ba?", ar: "أي هذه الحروف هو حرف الباء؟", tr: "Bu harflerden hangisi Ba'dır?" },
    options: [
      { id: "a", label: { en: "ب", ar: "ب", tr: "ب" } },
      { id: "b", label: { en: "ت", ar: "ت", tr: "ت" } },
      { id: "c", label: { en: "ث", ar: "ث", tr: "ث" } },
      { id: "d", label: { en: "ن", ar: "ن", tr: "ن" } },
    ],
    answer: ["a"],
  },
  {
    type: "true_false",
    skill: "letters",
    prompt: { en: "The Arabic alphabet has 28 letters.", ar: "عدد حروف الأبجدية العربية 28 حرفًا.", tr: "Arapça alfabede 28 harf vardır." },
    options: TRUE_FALSE,
    answer: ["true"],
  },
  {
    type: "single",
    skill: "vocab",
    prompt: { en: "What does the word كتاب mean?", ar: "ما معنى كلمة «كتاب» بالإنجليزية؟", tr: "كتاب kelimesi ne anlama gelir?" },
    options: [
      { id: "a", label: { en: "Book", ar: "Book", tr: "Kitap" } },
      { id: "b", label: { en: "Pen", ar: "Pen", tr: "Kalem" } },
      { id: "c", label: { en: "Door", ar: "Door", tr: "Kapı" } },
      { id: "d", label: { en: "Chair", ar: "Chair", tr: "Sandalye" } },
    ],
    answer: ["a"],
    difficulty: 1,
  },
  {
    type: "single",
    skill: "vocab",
    prompt: { en: "Which Arabic word means water?", ar: "أي هذه الكلمات تعني «Water» بالإنجليزية؟", tr: "Hangi Arapça kelime su demektir?" },
    options: [
      { id: "a", label: { en: "ماء", ar: "ماء", tr: "ماء" } },
      { id: "b", label: { en: "خبز", ar: "خبز", tr: "خبز" } },
      { id: "c", label: { en: "حليب", ar: "حليب", tr: "حليب" } },
      { id: "d", label: { en: "بيت", ar: "بيت", tr: "بيت" } },
    ],
    answer: ["a"],
    difficulty: 2,
  },
  {
    type: "text",
    skill: "vocab",
    prompt: { en: "Write the Arabic word for sun (one word).", ar: "اكتب كلمة «Sun» بالعربية (كلمة واحدة).", tr: "Güneş kelimesinin Arapçasını yaz (tek kelime)." },
    answer: ["شمس", "shams"],
    difficulty: 3,
  },
  {
    type: "single",
    skill: "reading",
    prompt: { en: "How many letters are in the word كَتَبَ?", ar: "كم حرفًا في كلمة «كَتَبَ»؟", tr: "كَتَبَ kelimesinde kaç harf vardır?" },
    options: [
      { id: "a", label: { en: "2", ar: "2", tr: "2" } },
      { id: "b", label: { en: "3", ar: "3", tr: "3" } },
      { id: "c", label: { en: "4", ar: "4", tr: "4" } },
    ],
    answer: ["b"],
    difficulty: 2,
  },
  {
    type: "multiple",
    skill: "reading",
    prompt: {
      en: "Which words start with the letter Meem (م)? Choose all that apply.",
      ar: "أي هذه الكلمات تبدأ بحرف الميم؟ اختر كل ما ينطبق.",
      tr: "Hangi kelimeler Mim (م) harfiyle başlar? Uygun olanların hepsini seç.",
    },
    options: [
      { id: "a", label: { en: "مدرسة", ar: "مدرسة", tr: "مدرسة" } },
      { id: "b", label: { en: "كتاب", ar: "كتاب", tr: "كتاب" } },
      { id: "c", label: { en: "ماء", ar: "ماء", tr: "ماء" } },
      { id: "d", label: { en: "بيت", ar: "بيت", tr: "بيت" } },
    ],
    answer: ["a", "c"],
    difficulty: 3,
  },
  {
    type: "order",
    skill: "reading",
    prompt: {
      en: "Put the words in order to make the sentence: I read a book.",
      ar: "رتّب الكلمات لتكوّن الجملة: أنا أقرأ كتابًا.",
      tr: "Kelimeleri sıraya koy: Ben bir kitap okuyorum.",
    },
    options: [
      { id: "a", label: { en: "أنا", ar: "أنا", tr: "أنا" } },
      { id: "b", label: { en: "أقرأ", ar: "أقرأ", tr: "أقرأ" } },
      { id: "c", label: { en: "كتابًا", ar: "كتابًا", tr: "كتابًا" } },
    ],
    answer: ["a", "b", "c"],
    difficulty: 3,
  },
];

// ───────────── Seeding ─────────────

async function upsertQuestions(db: Db, quizId: string, questions: QuestionSeed[]) {
  const existing = await db.query.quizQuestions.findFirst({ where: eq(quizQuestions.quizId, quizId), columns: { id: true } });
  if (existing) return; // never replace questions that learners may have answered
  await db.insert(quizQuestions).values(
    questions.map((q, i) => ({
      quizId,
      type: q.type,
      prompt: q.prompt,
      options: (q.options ?? []) as QuestionOption[],
      answer: q.answer,
      explanation: q.explanation ?? null,
      skill: q.skill ?? null,
      difficulty: q.difficulty ?? 1,
      sortOrder: i,
    })),
  );
}

export async function seedPrograms(db: Db) {
  for (const p of PROGRAMS) {
    await db
      .insert(programs)
      .values({ ...p, published: true })
      .onConflictDoUpdate({
        target: programs.slug,
        set: { name: p.name, description: p.description, icon: p.icon, color: p.color, features: p.features, sortOrder: p.sortOrder },
      });
  }
  console.log(`  programs: ${PROGRAMS.length}`);
}

export async function seedCatalog(db: Db) {
  const courseIds = new Map<string, string>();

  for (const c of COURSES) {
    const program = await db.query.programs.findFirst({ where: eq(programs.slug, c.programSlug), columns: { id: true } });
    if (!program) throw new Error(`Program ${c.programSlug} missing: run seedPrograms first.`);

    const [course] = await db
      .insert(courses)
      .values({
        programId: program.id,
        slug: c.slug,
        title: c.title,
        description: c.description,
        level: c.level,
        ageMin: c.ageMin,
        ageMax: c.ageMax,
        isFree: false,
        published: true,
      })
      .onConflictDoUpdate({
        target: courses.slug,
        set: { title: c.title, description: c.description, level: c.level, ageMin: c.ageMin, ageMax: c.ageMax, programId: program.id },
      })
      .returning({ id: courses.id });
    courseIds.set(c.slug, course!.id);

    for (let ui = 0; ui < c.units.length; ui++) {
      const u = c.units[ui]!;
      // Units have no natural key: match by English title inside the course.
      const existingUnits = await db.select().from(units).where(eq(units.courseId, course!.id));
      let unit = existingUnits.find((x) => x.title.en === u.title.en);
      if (!unit) {
        [unit] = await db.insert(units).values({ courseId: course!.id, title: u.title, sortOrder: ui }).returning();
      } else {
        await db.update(units).set({ title: u.title, sortOrder: ui }).where(eq(units.id, unit.id));
      }

      for (let li = 0; li < u.lessons.length; li++) {
        const l = u.lessons[li]!;
        const values = {
          unitId: unit!.id,
          courseId: course!.id,
          slug: l.slug,
          type: l.type,
          title: l.title,
          summary: l.summary,
          body: l.body ?? null,
          videoDurationSec: l.durationSec ?? null,
          context: l.context ?? {},
          isPreview: l.isPreview ?? false,
          published: true,
          sortOrder: li,
          xpReward: l.type === "quiz" ? 5 : 10,
        };
        const [lesson] = await db
          .insert(lessons)
          .values(values)
          .onConflictDoUpdate({
            target: [lessons.courseId, lessons.slug],
            set: {
              unitId: values.unitId,
              type: values.type,
              title: values.title,
              summary: values.summary,
              body: values.body,
              videoDurationSec: values.videoDurationSec,
              context: values.context,
              isPreview: values.isPreview,
              sortOrder: values.sortOrder,
            },
          })
          .returning({ id: lessons.id });

        if (l.quiz) {
          let quiz = await db.query.quizzes.findFirst({
            where: and(eq(quizzes.lessonId, lesson!.id), eq(quizzes.kind, "lesson")),
          });
          if (!quiz) {
            [quiz] = await db.insert(quizzes).values({ lessonId: lesson!.id, title: l.quiz.title, kind: "lesson", passScore: 0.6 }).returning();
          } else {
            await db.update(quizzes).set({ title: l.quiz.title }).where(eq(quizzes.id, quiz.id));
          }
          await upsertQuestions(db, quiz!.id, l.quiz.questions);
        }
      }
    }
  }
  console.log(`  courses: ${COURSES.length}`);

  await seedPlacement(db, courseIds);
}

async function seedPlacement(db: Db, courseIds: Map<string, string>) {
  const all = await db.select().from(quizzes).where(eq(quizzes.kind, "placement"));
  let quiz = all.find((q) => q.title.en === PLACEMENT_TITLE.en);
  if (!quiz) {
    [quiz] = await db.insert(quizzes).values({ lessonId: null, title: PLACEMENT_TITLE, kind: "placement", passScore: 0.5, shuffle: true }).returning();
  }
  await upsertQuestions(db, quiz!.id, PLACEMENT_QUESTIONS);

  const alphabet = courseIds.get("arabic-alphabet");
  const quran = courseIds.get("quran-for-beginners");
  if (!alphabet || !quran) return;

  // Rules are plain config: replace them wholesale so edits to this file take effect.
  await db.delete(placementRules).where(eq(placementRules.quizId, quiz!.id));
  await db.insert(placementRules).values([
    { quizId: quiz!.id, courseId: alphabet, priority: 30, condition: { skills: { letters: { max: 0.5 } } } },
    { quizId: quiz!.id, courseId: alphabet, priority: 20, condition: { maxScore: 0.5 } },
    { quizId: quiz!.id, courseId: quran, priority: 10, condition: { minScore: 0.5 } },
  ]);
  console.log(`  placement: ${PLACEMENT_QUESTIONS.length} questions, 3 rules`);
}
