import { z } from "zod";
import { LESSON_TYPES, LEVELS } from "@mufasa/db/schema";
import type { I18nText } from "@mufasa/config/locales";

/** Shared (client + server) zod schemas for catalog editing. */

const trimmed = (v: string | undefined) => {
  const s = v?.trim();
  return s ? s : undefined;
};

function cleanI18n(v: { en?: string; ar?: string; tr?: string }): I18nText {
  const out: I18nText = { en: (v.en ?? "").trim() };
  const ar = trimmed(v.ar);
  const tr = trimmed(v.tr);
  if (ar) out.ar = ar;
  if (tr) out.tr = tr;
  return out;
}

const i18nShape = z.object({ en: z.string().optional(), ar: z.string().optional(), tr: z.string().optional() });

/** Required translatable text: English is mandatory. */
export const i18nRequired = i18nShape
  .refine((v) => (v.en ?? "").trim().length > 0, { message: "required", path: ["en"] })
  .transform(cleanI18n);

/** Optional translatable text: all-empty becomes null. */
export const i18nOptional = i18nShape
  .nullish()
  .transform((v): I18nText | null => {
    if (!v) return null;
    const c = cleanI18n(v);
    return c.en || c.ar || c.tr ? c : null;
  });

const nullableText = z
  .string()
  .nullish()
  .transform((v) => {
    const s = v?.trim();
    return s ? s : null;
  });

const nullableInt = z.number().int().min(0).nullish().transform((v) => v ?? null);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug");

export const programInput = z.object({
  id: z.uuid().optional(),
  slug: slugSchema,
  name: i18nRequired,
  description: i18nOptional,
  icon: nullableText,
  color: nullableText,
  features: z.object({
    hifz: z.boolean().optional(),
    recitation: z.boolean().optional(),
    liveClasses: z.boolean().optional(),
    placement: z.boolean().optional(),
  }),
  published: z.boolean(),
});
export type ProgramInput = z.input<typeof programInput>;

export const courseInput = z.object({
  id: z.uuid().optional(),
  programId: z.uuid(),
  slug: slugSchema,
  title: i18nRequired,
  description: i18nOptional,
  level: z.enum(LEVELS),
  ageMin: nullableInt,
  ageMax: nullableInt,
  coverPath: nullableText,
  isFree: z.boolean(),
  published: z.boolean(),
});
export type CourseInput = z.input<typeof courseInput>;

export const unitInput = z.object({
  id: z.uuid().optional(),
  courseId: z.uuid(),
  title: i18nRequired,
  description: i18nOptional,
});
export type UnitInput = z.input<typeof unitInput>;

const lessonContext = z.object({
  objectives: z.array(z.string()).optional(),
  approach: z.string().optional(),
  vocabulary: z.array(z.object({ term: z.string(), meaning: z.string().optional() })).optional(),
  ayahRefs: z
    .array(z.object({ surah: z.number().int().min(1).max(114), from: z.number().int().min(1), to: z.number().int().min(1) }))
    .optional(),
  notes: z.string().optional(),
});

export const lessonInput = z.object({
  id: z.uuid().optional(),
  unitId: z.uuid(),
  /** Optional: derived from the title when empty. */
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => v || undefined)
    .optional(),
  type: z.enum(LESSON_TYPES),
  title: i18nRequired,
  summary: i18nOptional,
  body: i18nOptional,
  videoPath: nullableText,
  videoDurationSec: nullableInt,
  context: lessonContext,
  isPreview: z.boolean(),
  published: z.boolean(),
  xpReward: z.number().int().min(0).max(1000),
});
export type LessonInput = z.input<typeof lessonInput>;

export const assetInput = z.object({
  id: z.uuid().optional(),
  lessonId: z.uuid(),
  kind: z.enum(["pdf", "image", "audio", "link", "worksheet"]),
  title: i18nRequired,
  path: nullableText,
  url: nullableText,
});
export type AssetInput = z.input<typeof assetInput>;

export const quizInput = z.object({
  id: z.uuid().optional(),
  lessonId: z.uuid().nullish().transform((v) => v ?? null),
  title: i18nRequired,
  kind: z.enum(["lesson", "placement", "homework"]),
  passScore: z.number().min(0).max(1),
  timeLimitSec: z.number().int().min(10).nullish().transform((v) => v ?? null),
  shuffle: z.boolean(),
});
export type QuizInput = z.input<typeof quizInput>;

export const QUESTION_TYPES = ["single", "multiple", "true_false", "text", "order", "match", "audio_choice"] as const;

export const questionInput = z.object({
  id: z.uuid().optional(),
  quizId: z.uuid(),
  type: z.enum(QUESTION_TYPES),
  prompt: i18nRequired,
  promptAudioPath: nullableText,
  options: z.array(
    z.object({
      id: z.string().min(1),
      label: i18nRequired,
      audioPath: z.string().optional(),
      imagePath: z.string().optional(),
    }),
  ),
  answer: z.array(z.string()).min(1),
  explanation: i18nOptional,
  skill: nullableText,
  difficulty: z.number().int().min(1).max(5),
  points: z.number().int().min(1).max(100),
});
export type QuestionInput = z.input<typeof questionInput>;

export const placementRuleInput = z.object({
  id: z.uuid().optional(),
  quizId: z.uuid(),
  courseId: z.uuid(),
  priority: z.number().int(),
  condition: z.object({
    minScore: z.number().min(0).max(1).optional(),
    maxScore: z.number().min(0).max(1).optional(),
    skills: z.record(z.string(), z.object({ min: z.number().optional(), max: z.number().optional() })).optional(),
    ageMin: z.number().int().optional(),
    ageMax: z.number().int().optional(),
  }),
});

export function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "item";
}
