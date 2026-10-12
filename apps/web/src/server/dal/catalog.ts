import "server-only";
import { z } from "zod";
import { and, asc, count, eq, getDb, inArray, ne, schema, sql } from "@mufasa/db";
import {
  assetInput,
  courseInput,
  lessonInput,
  programInput,
  questionInput,
  quizInput,
  slugify,
  unitInput,
} from "@/lib/catalog-schemas";
import { audit } from "../audit";
import { conflict, forbidden, notFound } from "../errors";
import type { SessionUser } from "../session";

type Actor = Pick<SessionUser, "id" | "role">;

const isStaff = (a: Actor | null | undefined) => a?.role === "admin" || a?.role === "tutor";

function requireAdmin(actor: Actor) {
  if (actor.role !== "admin") throw forbidden();
}
function requireStaff(actor: Actor) {
  if (!isStaff(actor)) throw forbidden();
}

export type Program = typeof schema.programs.$inferSelect;
export type Course = typeof schema.courses.$inferSelect;
export type Unit = typeof schema.units.$inferSelect;
export type Lesson = typeof schema.lessons.$inferSelect;
export type LessonAsset = typeof schema.lessonAssets.$inferSelect;
export type Quiz = typeof schema.quizzes.$inferSelect;
export type QuizQuestion = typeof schema.quizQuestions.$inferSelect;

// ───────────── Public reads (no session needed) ─────────────

export async function listPublishedPrograms(): Promise<Program[]> {
  return getDb()
    .select()
    .from(schema.programs)
    .where(eq(schema.programs.published, true))
    .orderBy(asc(schema.programs.sortOrder), asc(schema.programs.createdAt));
}

export type CourseListItem = Course & { program: Pick<Program, "id" | "slug" | "name" | "features"> };

export async function listPublishedCourses(programSlug?: string): Promise<CourseListItem[]> {
  const rows = await getDb()
    .select({
      course: schema.courses,
      program: {
        id: schema.programs.id,
        slug: schema.programs.slug,
        name: schema.programs.name,
        features: schema.programs.features,
      },
    })
    .from(schema.courses)
    .innerJoin(schema.programs, eq(schema.programs.id, schema.courses.programId))
    .where(
      and(
        eq(schema.courses.published, true),
        eq(schema.programs.published, true),
        programSlug ? eq(schema.programs.slug, programSlug) : undefined,
      ),
    )
    .orderBy(asc(schema.programs.sortOrder), asc(schema.courses.sortOrder), asc(schema.courses.createdAt));
  return rows.map((r) => ({ ...r.course, program: r.program }));
}

/** Lesson fields that are safe to show in a syllabus (no video path, no body). */
export type LessonSummary = Pick<
  Lesson,
  | "id"
  | "unitId"
  | "courseId"
  | "slug"
  | "type"
  | "title"
  | "summary"
  | "isPreview"
  | "published"
  | "sortOrder"
  | "videoDurationSec"
  | "xpReward"
>;

export type CourseDetail = CourseListItem & { units: (Unit & { lessons: LessonSummary[] })[] };

/**
 * Course with its syllabus. Anonymous visitors and non-staff only see published
 * courses, programs and lessons; staff also see drafts.
 */
export async function getCourseBySlug(slug: string, viewer?: Actor | null): Promise<CourseDetail | null> {
  const staff = isStaff(viewer);
  const db = getDb();
  const [row] = await db
    .select({
      course: schema.courses,
      program: {
        id: schema.programs.id,
        slug: schema.programs.slug,
        name: schema.programs.name,
        features: schema.programs.features,
      },
      programPublished: schema.programs.published,
    })
    .from(schema.courses)
    .innerJoin(schema.programs, eq(schema.programs.id, schema.courses.programId))
    .where(eq(schema.courses.slug, slug))
    .limit(1);
  if (!row) return null;
  if (!staff && !(row.course.published && row.programPublished)) return null;

  const [units, lessons] = await Promise.all([
    db.select().from(schema.units).where(eq(schema.units.courseId, row.course.id)).orderBy(asc(schema.units.sortOrder)),
    db
      .select({
        id: schema.lessons.id,
        unitId: schema.lessons.unitId,
        courseId: schema.lessons.courseId,
        slug: schema.lessons.slug,
        type: schema.lessons.type,
        title: schema.lessons.title,
        summary: schema.lessons.summary,
        isPreview: schema.lessons.isPreview,
        published: schema.lessons.published,
        sortOrder: schema.lessons.sortOrder,
        videoDurationSec: schema.lessons.videoDurationSec,
        xpReward: schema.lessons.xpReward,
      })
      .from(schema.lessons)
      .where(and(eq(schema.lessons.courseId, row.course.id), staff ? undefined : eq(schema.lessons.published, true)))
      .orderBy(asc(schema.lessons.sortOrder)),
  ]);
  return {
    ...row.course,
    program: row.program,
    units: units.map((u) => ({ ...u, lessons: lessons.filter((l) => l.unitId === u.id) })),
  };
}

// ───────────── Staff reads ─────────────

export async function listPrograms(actor: Actor): Promise<Program[]> {
  requireStaff(actor);
  return getDb().select().from(schema.programs).orderBy(asc(schema.programs.sortOrder), asc(schema.programs.createdAt));
}

export type AdminCourseRow = Course & { programName: Program["name"]; unitCount: number; lessonCount: number };

export async function listCourses(actor: Actor, filter: { programId?: string } = {}): Promise<AdminCourseRow[]> {
  requireStaff(actor);
  const db = getDb();
  const rows = await db
    .select({ course: schema.courses, programName: schema.programs.name })
    .from(schema.courses)
    .innerJoin(schema.programs, eq(schema.programs.id, schema.courses.programId))
    .where(filter.programId ? eq(schema.courses.programId, filter.programId) : undefined)
    .orderBy(asc(schema.programs.sortOrder), asc(schema.courses.sortOrder), asc(schema.courses.createdAt));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.course.id);
  const [unitCounts, lessonCounts] = await Promise.all([
    db
      .select({ courseId: schema.units.courseId, n: count() })
      .from(schema.units)
      .where(inArray(schema.units.courseId, ids))
      .groupBy(schema.units.courseId),
    db
      .select({ courseId: schema.lessons.courseId, n: count() })
      .from(schema.lessons)
      .where(inArray(schema.lessons.courseId, ids))
      .groupBy(schema.lessons.courseId),
  ]);
  const u = new Map(unitCounts.map((x) => [x.courseId, x.n]));
  const l = new Map(lessonCounts.map((x) => [x.courseId, x.n]));
  return rows.map((r) => ({
    ...r.course,
    programName: r.programName,
    unitCount: u.get(r.course.id) ?? 0,
    lessonCount: l.get(r.course.id) ?? 0,
  }));
}

export type EditorQuiz = Quiz & { questions: QuizQuestion[] };
export type EditorLesson = Lesson & { assets: LessonAsset[]; quizzes: EditorQuiz[] };
export type CourseEditorData = Course & { programName: Program["name"]; units: (Unit & { lessons: EditorLesson[] })[] };

/** Everything the course editor needs, including answers (staff only). */
export async function getCourseForEditor(actor: Actor, courseId: string): Promise<CourseEditorData> {
  requireStaff(actor);
  const db = getDb();
  const [row] = await db
    .select({ course: schema.courses, programName: schema.programs.name })
    .from(schema.courses)
    .innerJoin(schema.programs, eq(schema.programs.id, schema.courses.programId))
    .where(eq(schema.courses.id, courseId))
    .limit(1);
  if (!row) throw notFound();
  const [units, lessons] = await Promise.all([
    db.select().from(schema.units).where(eq(schema.units.courseId, courseId)).orderBy(asc(schema.units.sortOrder)),
    db.select().from(schema.lessons).where(eq(schema.lessons.courseId, courseId)).orderBy(asc(schema.lessons.sortOrder)),
  ]);
  const lessonIds = lessons.map((x) => x.id);
  const [assets, quizzes] = lessonIds.length
    ? await Promise.all([
        db
          .select()
          .from(schema.lessonAssets)
          .where(inArray(schema.lessonAssets.lessonId, lessonIds))
          .orderBy(asc(schema.lessonAssets.sortOrder)),
        db.select().from(schema.quizzes).where(inArray(schema.quizzes.lessonId, lessonIds)),
      ])
    : [[], []];
  const quizIds = quizzes.map((q) => q.id);
  const questions = quizIds.length
    ? await db
        .select()
        .from(schema.quizQuestions)
        .where(inArray(schema.quizQuestions.quizId, quizIds))
        .orderBy(asc(schema.quizQuestions.sortOrder))
    : [];
  return {
    ...row.course,
    programName: row.programName,
    units: units.map((u) => ({
      ...u,
      lessons: lessons
        .filter((l) => l.unitId === u.id)
        .map((l) => ({
          ...l,
          assets: assets.filter((a) => a.lessonId === l.id),
          quizzes: quizzes
            .filter((q) => q.lessonId === l.id)
            .map((q) => ({ ...q, questions: questions.filter((x) => x.quizId === q.id) })),
        })),
    })),
  };
}

export async function adminOverviewCounts(actor: Actor) {
  requireAdmin(actor);
  const db = getDb();
  const [[students], [courses], [lessons], [programs]] = await Promise.all([
    db.select({ n: count() }).from(schema.user).where(eq(schema.user.role, "student")),
    db.select({ n: count() }).from(schema.courses),
    db.select({ n: count() }).from(schema.lessons),
    db.select({ n: count() }).from(schema.programs),
  ]);
  return {
    students: students?.n ?? 0,
    courses: courses?.n ?? 0,
    lessons: lessons?.n ?? 0,
    programs: programs?.n ?? 0,
  };
}

// ───────────── Programs (admin) ─────────────

export async function saveProgram(actor: Actor, raw: z.input<typeof programInput>) {
  requireAdmin(actor);
  const input = programInput.parse(raw);
  const db = getDb();
  const dup = await db.query.programs.findFirst({
    where: input.id ? and(eq(schema.programs.slug, input.slug), ne(schema.programs.id, input.id)) : eq(schema.programs.slug, input.slug),
    columns: { id: true },
  });
  if (dup) throw conflict("slug");
  const values = {
    slug: input.slug,
    name: input.name,
    description: input.description,
    icon: input.icon,
    color: input.color,
    features: input.features,
    published: input.published,
  };
  if (input.id) {
    const [row] = await db.update(schema.programs).set(values).where(eq(schema.programs.id, input.id)).returning();
    if (!row) throw notFound();
    await audit({ actorId: actor.id, action: "program.update", entity: "programs", entityId: row.id });
    return row;
  }
  const [max] = await db.select({ m: sql<number>`coalesce(max(${schema.programs.sortOrder}), -1)` }).from(schema.programs);
  const [row] = await db
    .insert(schema.programs)
    .values({ ...values, sortOrder: (max?.m ?? -1) + 1 })
    .returning();
  await audit({ actorId: actor.id, action: "program.create", entity: "programs", entityId: row!.id });
  return row!;
}

export async function deleteProgram(actor: Actor, id: string) {
  requireAdmin(actor);
  const db = getDb();
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(schema.courses).where(eq(schema.courses.programId, id));
  if (n > 0) throw conflict("program_has_courses");
  await db.delete(schema.programs).where(eq(schema.programs.id, id));
  await audit({ actorId: actor.id, action: "program.delete", entity: "programs", entityId: id });
}

// ───────────── Courses (admin) ─────────────

export async function saveCourse(actor: Actor, raw: z.input<typeof courseInput>) {
  requireAdmin(actor);
  const input = courseInput.parse(raw);
  const db = getDb();
  const dup = await db.query.courses.findFirst({
    where: input.id ? and(eq(schema.courses.slug, input.slug), ne(schema.courses.id, input.id)) : eq(schema.courses.slug, input.slug),
    columns: { id: true },
  });
  if (dup) throw conflict("slug");
  const { id, ...rest } = input;
  if (id) {
    const [row] = await db.update(schema.courses).set(rest).where(eq(schema.courses.id, id)).returning();
    if (!row) throw notFound();
    await audit({ actorId: actor.id, action: "course.update", entity: "courses", entityId: id });
    return row;
  }
  const [max] = await db
    .select({ m: sql<number>`coalesce(max(${schema.courses.sortOrder}), -1)` })
    .from(schema.courses)
    .where(eq(schema.courses.programId, input.programId));
  const [row] = await db
    .insert(schema.courses)
    .values({ ...rest, sortOrder: (max?.m ?? -1) + 1, createdBy: actor.id })
    .returning();
  await audit({ actorId: actor.id, action: "course.create", entity: "courses", entityId: row!.id });
  return row!;
}

export async function deleteCourse(actor: Actor, id: string) {
  requireAdmin(actor);
  await getDb().delete(schema.courses).where(eq(schema.courses.id, id));
  await audit({ actorId: actor.id, action: "course.delete", entity: "courses", entityId: id });
}

// ───────────── Units (admin) ─────────────

export async function saveUnit(actor: Actor, raw: z.input<typeof unitInput>) {
  requireAdmin(actor);
  const input = unitInput.parse(raw);
  const db = getDb();
  const { id, ...rest } = input;
  if (id) {
    const [row] = await db.update(schema.units).set({ title: rest.title, description: rest.description }).where(eq(schema.units.id, id)).returning();
    if (!row) throw notFound();
    await audit({ actorId: actor.id, action: "unit.update", entity: "units", entityId: id });
    return row;
  }
  const [max] = await db
    .select({ m: sql<number>`coalesce(max(${schema.units.sortOrder}), -1)` })
    .from(schema.units)
    .where(eq(schema.units.courseId, input.courseId));
  const [row] = await db
    .insert(schema.units)
    .values({ ...rest, sortOrder: (max?.m ?? -1) + 1 })
    .returning();
  await audit({ actorId: actor.id, action: "unit.create", entity: "units", entityId: row!.id });
  return row!;
}

export async function deleteUnit(actor: Actor, id: string) {
  requireAdmin(actor);
  await getDb().delete(schema.units).where(eq(schema.units.id, id));
  await audit({ actorId: actor.id, action: "unit.delete", entity: "units", entityId: id });
}

// ───────────── Lessons (admin + tutor) ─────────────

async function uniqueLessonSlug(courseId: string, base: string, exceptId?: string) {
  const db = getDb();
  const existing = await db
    .select({ slug: schema.lessons.slug })
    .from(schema.lessons)
    .where(and(eq(schema.lessons.courseId, courseId), exceptId ? ne(schema.lessons.id, exceptId) : undefined));
  const taken = new Set(existing.map((r) => r.slug));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  return slug;
}

export async function saveLesson(actor: Actor, raw: z.input<typeof lessonInput>) {
  requireStaff(actor);
  const input = lessonInput.parse(raw);
  const db = getDb();
  const unit = await db.query.units.findFirst({ where: eq(schema.units.id, input.unitId), columns: { id: true, courseId: true } });
  if (!unit) throw notFound();
  const { id, slug, ...rest } = input;
  const baseSlug = slugify(slug ?? input.title.en);
  const finalSlug = await uniqueLessonSlug(unit.courseId, baseSlug, id);
  if (id) {
    const [row] = await db
      .update(schema.lessons)
      .set({ ...rest, courseId: unit.courseId, slug: slug ? finalSlug : undefined })
      .where(eq(schema.lessons.id, id))
      .returning();
    if (!row) throw notFound();
    await audit({ actorId: actor.id, action: "lesson.update", entity: "lessons", entityId: id });
    return row;
  }
  const [max] = await db
    .select({ m: sql<number>`coalesce(max(${schema.lessons.sortOrder}), -1)` })
    .from(schema.lessons)
    .where(eq(schema.lessons.unitId, unit.id));
  const [row] = await db
    .insert(schema.lessons)
    .values({ ...rest, courseId: unit.courseId, slug: finalSlug, sortOrder: (max?.m ?? -1) + 1 })
    .returning();
  await audit({ actorId: actor.id, action: "lesson.create", entity: "lessons", entityId: row!.id });
  return row!;
}

export async function deleteLesson(actor: Actor, id: string) {
  requireStaff(actor);
  await getDb().delete(schema.lessons).where(eq(schema.lessons.id, id));
  await audit({ actorId: actor.id, action: "lesson.delete", entity: "lessons", entityId: id });
}

export async function saveLessonAsset(actor: Actor, raw: z.input<typeof assetInput>) {
  requireStaff(actor);
  const input = assetInput.parse(raw);
  if (!input.path && !input.url) throw conflict("asset_needs_path_or_url");
  const db = getDb();
  const { id, ...rest } = input;
  if (id) {
    const [row] = await db.update(schema.lessonAssets).set(rest).where(eq(schema.lessonAssets.id, id)).returning();
    if (!row) throw notFound();
    return row;
  }
  const [max] = await db
    .select({ m: sql<number>`coalesce(max(${schema.lessonAssets.sortOrder}), -1)` })
    .from(schema.lessonAssets)
    .where(eq(schema.lessonAssets.lessonId, input.lessonId));
  const [row] = await db
    .insert(schema.lessonAssets)
    .values({ ...rest, sortOrder: (max?.m ?? -1) + 1 })
    .returning();
  return row!;
}

export async function deleteLessonAsset(actor: Actor, id: string) {
  requireStaff(actor);
  await getDb().delete(schema.lessonAssets).where(eq(schema.lessonAssets.id, id));
}

// ───────────── Quizzes (admin) ─────────────

export async function saveQuiz(actor: Actor, raw: z.input<typeof quizInput>) {
  requireAdmin(actor);
  const input = quizInput.parse(raw);
  const db = getDb();
  const { id, ...rest } = input;
  if (id) {
    const [row] = await db.update(schema.quizzes).set(rest).where(eq(schema.quizzes.id, id)).returning();
    if (!row) throw notFound();
    await audit({ actorId: actor.id, action: "quiz.update", entity: "quizzes", entityId: id });
    return row;
  }
  const [row] = await db.insert(schema.quizzes).values(rest).returning();
  await audit({ actorId: actor.id, action: "quiz.create", entity: "quizzes", entityId: row!.id });
  return row!;
}

export async function deleteQuiz(actor: Actor, id: string) {
  requireAdmin(actor);
  await getDb().delete(schema.quizzes).where(eq(schema.quizzes.id, id));
  await audit({ actorId: actor.id, action: "quiz.delete", entity: "quizzes", entityId: id });
}

export async function saveQuestion(actor: Actor, raw: z.input<typeof questionInput>) {
  requireAdmin(actor);
  const input = questionInput.parse(raw);
  const db = getDb();
  const { id, ...rest } = input;
  if (id) {
    const [row] = await db.update(schema.quizQuestions).set(rest).where(eq(schema.quizQuestions.id, id)).returning();
    if (!row) throw notFound();
    return row;
  }
  const [max] = await db
    .select({ m: sql<number>`coalesce(max(${schema.quizQuestions.sortOrder}), -1)` })
    .from(schema.quizQuestions)
    .where(eq(schema.quizQuestions.quizId, input.quizId));
  const [row] = await db
    .insert(schema.quizQuestions)
    .values({ ...rest, sortOrder: (max?.m ?? -1) + 1 })
    .returning();
  return row!;
}

export async function deleteQuestion(actor: Actor, id: string) {
  requireAdmin(actor);
  await getDb().delete(schema.quizQuestions).where(eq(schema.quizQuestions.id, id));
}

// ───────────── Ordering and publishing ─────────────

const ORDERABLE = {
  programs: schema.programs,
  courses: schema.courses,
  units: schema.units,
  lessons: schema.lessons,
  questions: schema.quizQuestions,
  assets: schema.lessonAssets,
} as const;
export type Orderable = keyof typeof ORDERABLE;

/** Rewrites sortOrder to follow the given id order. */
export async function reorder(actor: Actor, entity: Orderable, ids: string[]) {
  if (entity === "lessons") requireStaff(actor);
  else requireAdmin(actor);
  const table = ORDERABLE[entity];
  await getDb().transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx.update(table).set({ sortOrder: i }).where(eq(table.id, ids[i]!));
    }
  });
}

export async function setPublished(actor: Actor, entity: "programs" | "courses" | "lessons", id: string, published: boolean) {
  if (entity === "lessons") requireStaff(actor);
  else requireAdmin(actor);
  const db = getDb();
  if (entity === "programs") await db.update(schema.programs).set({ published }).where(eq(schema.programs.id, id));
  else if (entity === "courses") await db.update(schema.courses).set({ published }).where(eq(schema.courses.id, id));
  else await db.update(schema.lessons).set({ published }).where(eq(schema.lessons.id, id));
  await audit({ actorId: actor.id, action: `${entity}.publish`, entity, entityId: id, after: { published } });
}

