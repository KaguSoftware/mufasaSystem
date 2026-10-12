import "server-only";
import { and, asc, desc, eq, getDb, inArray, schema } from "@mufasa/db";
import { evaluatePlacement } from "@/lib/placement";
import { gradeQuiz, type AnswerMap } from "@/lib/quiz-grading";
import { ageFromBirthYear, isParentOf, type SessionUser } from "../session";
import { forbidden, notFound } from "../errors";
import { toPlayerQuestions, type PlayerQuiz } from "./quiz";

type Actor = Pick<SessionUser, "id" | "role">;

/** The active placement quiz: the newest quiz with kind "placement". Null when none exists. */
export async function getPlacementQuiz(): Promise<PlayerQuiz | null> {
  const db = getDb();
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.kind, "placement"),
    orderBy: desc(schema.quizzes.createdAt),
  });
  if (!quiz) return null;
  const questions = await db
    .select()
    .from(schema.quizQuestions)
    .where(eq(schema.quizQuestions.quizId, quiz.id))
    .orderBy(asc(schema.quizQuestions.sortOrder));
  return {
    id: quiz.id,
    title: quiz.title,
    kind: "placement",
    passScore: quiz.passScore,
    timeLimitSec: quiz.timeLimitSec,
    questions: await toPlayerQuestions(questions, quiz.shuffle),
    lastAttempt: null,
  };
}

/** The student takes it, a parent for their child, an admin for anyone. */
async function assertCanTakePlacement(actor: Actor, studentId: string) {
  if (actor.id === studentId) return;
  if (actor.role === "admin") return;
  if (actor.role === "parent" && (await isParentOf(actor.id, studentId))) return;
  throw forbidden();
}

export type PlacementRecommendation = {
  courseId: string;
  slug: string;
  title: typeof schema.courses.$inferSelect.title;
  programName: typeof schema.programs.$inferSelect.name;
  level: typeof schema.courses.$inferSelect.level;
};

export type PlacementResult = {
  attemptId: string;
  score: number;
  skillScores: Record<string, number>;
  recommendations: PlacementRecommendation[];
};

export async function submitPlacement(actor: Actor, studentId: string, answers: AnswerMap): Promise<PlacementResult> {
  await assertCanTakePlacement(actor, studentId);
  const db = getDb();
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.kind, "placement"),
    orderBy: desc(schema.quizzes.createdAt),
  });
  if (!quiz) throw notFound();

  const [questions, rules, profile] = await Promise.all([
    db.select().from(schema.quizQuestions).where(eq(schema.quizQuestions.quizId, quiz.id)),
    db.select().from(schema.placementRules).where(eq(schema.placementRules.quizId, quiz.id)),
    db.query.profiles.findFirst({ where: eq(schema.profiles.userId, studentId), columns: { birthYear: true } }),
  ]);

  const result = gradeQuiz(questions, answers, quiz.passScore);
  const known = new Set(questions.map((q) => q.id));
  const clean: AnswerMap = Object.fromEntries(Object.entries(answers).filter(([id]) => known.has(id)));
  const [attempt] = await db
    .insert(schema.quizAttempts)
    .values({
      quizId: quiz.id,
      userId: studentId,
      answers: clean,
      score: result.score,
      passed: result.passed,
      skillScores: result.skillScores,
      submittedAt: new Date(),
    })
    .returning({ id: schema.quizAttempts.id });

  const courseIds = evaluatePlacement(rules, {
    score: result.score,
    skillScores: result.skillScores,
    age: ageFromBirthYear(profile?.birthYear),
  });
  const recommendations = await recommendationsFor(courseIds);
  return { attemptId: attempt!.id, score: result.score, skillScores: result.skillScores, recommendations };
}

async function recommendationsFor(courseIds: string[]): Promise<PlacementRecommendation[]> {
  if (!courseIds.length) return [];
  const rows = await getDb()
    .select({
      id: schema.courses.id,
      slug: schema.courses.slug,
      title: schema.courses.title,
      level: schema.courses.level,
      programName: schema.programs.name,
    })
    .from(schema.courses)
    .innerJoin(schema.programs, eq(schema.programs.id, schema.courses.programId))
    .where(and(inArray(schema.courses.id, courseIds), eq(schema.courses.published, true)));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return courseIds.flatMap((id) => {
    const r = byId.get(id);
    return r ? [{ courseId: r.id, slug: r.slug, title: r.title, programName: r.programName, level: r.level }] : [];
  });
}

/** Optional follow-up: enroll the student in the recommended courses (source "placement"). */
export async function enrollRecommended(actor: Actor, studentId: string, courseIds: string[]) {
  await assertCanTakePlacement(actor, studentId);
  if (!courseIds.length) return { enrolled: 0 };
  const db = getDb();
  const valid = await db
    .select({ id: schema.courses.id })
    .from(schema.courses)
    .where(and(inArray(schema.courses.id, courseIds), eq(schema.courses.published, true)));
  if (!valid.length) return { enrolled: 0 };
  await db
    .insert(schema.enrollments)
    .values(valid.map((c) => ({ userId: studentId, courseId: c.id, source: "placement" as const })))
    .onConflictDoNothing();
  return { enrolled: valid.length };
}

/** Who can the actor take the placement test for? Students: themself. Parents: their children. */
export async function placementTargets(actor: Actor): Promise<{ id: string; name: string }[]> {
  const db = getDb();
  if (actor.role === "student") {
    const me = await db.query.user.findFirst({ where: eq(schema.user.id, actor.id), columns: { id: true, name: true } });
    return me ? [{ id: me.id, name: me.name }] : [];
  }
  if (actor.role !== "parent") return [];
  const rows = await db
    .select({ id: schema.user.id, name: schema.user.name, displayName: schema.profiles.displayName })
    .from(schema.parentChildren)
    .innerJoin(schema.user, eq(schema.user.id, schema.parentChildren.childId))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.user.id))
    .where(eq(schema.parentChildren.parentId, actor.id));
  return rows.map((r) => ({ id: r.id, name: r.displayName ?? r.name }));
}
