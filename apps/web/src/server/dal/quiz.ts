import "server-only";
import { and, asc, desc, eq, getDb, schema } from "@mufasa/db";
import type { I18nText } from "@mufasa/config/locales";
import { gradeQuiz, type AnswerMap } from "@/lib/quiz-grading";
import { assertLessonAccess } from "../access";
import { forbidden, notFound } from "../errors";
import { storage } from "../storage";
import { awardXp } from "../services/gamification";
import type { SessionUser } from "../session";
import { completeLessonFor } from "./learn";
import { assertHomeworkQuizAccess, linkQuizAttemptToHomework } from "./homework";

type Actor = Pick<SessionUser, "id" | "role">;

export const QUIZ_PASS_XP = 20;

/** A question as sent to the browser: never contains `answer` or `explanation`. */
export type PlayerQuestion = {
  id: string;
  type: typeof schema.quizQuestions.$inferSelect.type;
  prompt: I18nText;
  promptAudioUrl: string | null;
  options: { id: string; label: I18nText; audioUrl: string | null }[];
  points: number;
  skill: string | null;
};

export type PlayerQuiz = {
  id: string;
  title: I18nText;
  kind: "lesson" | "placement" | "homework";
  passScore: number;
  timeLimitSec: number | null;
  questions: PlayerQuestion[];
  lastAttempt: { score: number; passed: boolean; submittedAt: Date | null } | null;
};

async function signedAudio(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  try {
    return await storage().signedUrl("lessonAssets", path, 60 * 60);
  } catch {
    return null;
  }
}

function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Strips answers and signs audio. Shared with the placement DAL. */
export async function toPlayerQuestions(
  questions: (typeof schema.quizQuestions.$inferSelect)[],
  shuffleOptions: boolean,
): Promise<PlayerQuestion[]> {
  return Promise.all(
    questions.map(async (q) => {
      // Order questions are always mixed, otherwise the stored order gives the answer away.
      // Match questions keep the left column in place and always mix the right column ("r-" ids).
      let opts = q.options;
      if (q.type === "order") opts = shuffled(q.options);
      else if (q.type === "match") {
        const rights = shuffled(q.options.filter((o) => o.id.startsWith("r-")));
        opts = [...q.options.filter((o) => !o.id.startsWith("r-")), ...rights];
      } else if (shuffleOptions && q.type !== "true_false") opts = shuffled(q.options);
      return {
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        promptAudioUrl: await signedAudio(q.promptAudioPath),
        options: await Promise.all(opts.map(async (o) => ({ id: o.id, label: o.label, audioUrl: await signedAudio(o.audioPath) }))),
        points: q.points,
        skill: q.skill,
      };
    }),
  );
}

async function loadPlayerQuiz(userId: string, quiz: typeof schema.quizzes.$inferSelect): Promise<PlayerQuiz> {
  const db = getDb();
  const [questions, last] = await Promise.all([
    db.select().from(schema.quizQuestions).where(eq(schema.quizQuestions.quizId, quiz.id)).orderBy(asc(schema.quizQuestions.sortOrder)),
    db.query.quizAttempts.findFirst({
      where: and(eq(schema.quizAttempts.quizId, quiz.id), eq(schema.quizAttempts.userId, userId)),
      orderBy: desc(schema.quizAttempts.submittedAt),
      columns: { score: true, passed: true, submittedAt: true },
    }),
  ]);
  return {
    id: quiz.id,
    title: quiz.title,
    kind: quiz.kind,
    passScore: quiz.passScore,
    timeLimitSec: quiz.timeLimitSec,
    questions: await toPlayerQuestions(questions, quiz.shuffle),
    lastAttempt: last ?? null,
  };
}

/** The lesson's quiz (if any), after the lesson access check. */
export async function getQuizForLesson(actor: Actor, lessonId: string): Promise<PlayerQuiz | null> {
  await assertLessonAccess(actor, lessonId);
  const quiz = await getDb().query.quizzes.findFirst({
    where: and(eq(schema.quizzes.lessonId, lessonId), eq(schema.quizzes.kind, "lesson")),
  });
  return quiz ? loadPlayerQuiz(actor.id, quiz) : null;
}

export async function getQuizForPlayer(actor: Actor, quizId: string): Promise<PlayerQuiz> {
  const quiz = await getDb().query.quizzes.findFirst({ where: eq(schema.quizzes.id, quizId) });
  if (!quiz) throw notFound();
  if (quiz.kind === "placement") throw forbidden();
  if (quiz.lessonId) await assertLessonAccess(actor, quiz.lessonId);
  // Homework quizzes have no lesson: only students with homework pointing at them may take them.
  await assertHomeworkQuizAccess(actor, quiz.id);
  return loadPlayerQuiz(actor.id, quiz);
}

export type QuizSubmission = {
  attemptId: string;
  score: number;
  passed: boolean;
  passScore: number;
  perQuestion: Record<string, boolean>;
  explanations: Record<string, I18nText>;
  xpAwarded: boolean;
};

export async function submitQuiz(actor: Actor, quizId: string, answers: AnswerMap): Promise<QuizSubmission> {
  const db = getDb();
  const quiz = await db.query.quizzes.findFirst({ where: eq(schema.quizzes.id, quizId) });
  if (!quiz) throw notFound();
  if (quiz.kind === "placement") throw forbidden(); // placement has its own flow
  if (quiz.lessonId) await assertLessonAccess(actor, quiz.lessonId);
  await assertHomeworkQuizAccess(actor, quiz.id);

  const questions = await db.select().from(schema.quizQuestions).where(eq(schema.quizQuestions.quizId, quizId));
  const result = gradeQuiz(questions, answers, quiz.passScore);

  // Keep only answers for questions that exist.
  const known = new Set(questions.map((q) => q.id));
  const clean: AnswerMap = Object.fromEntries(Object.entries(answers).filter(([id]) => known.has(id)));

  const [attempt] = await db
    .insert(schema.quizAttempts)
    .values({
      quizId,
      userId: actor.id,
      answers: clean,
      score: result.score,
      passed: result.passed,
      skillScores: result.skillScores,
      submittedAt: new Date(),
    })
    .returning({ id: schema.quizAttempts.id });
  if (quiz.kind === "homework") await linkQuizAttemptToHomework(actor.id, quizId, attempt!.id);

  let xpAwarded = false;
  if (result.passed) {
    const res = await awardXp(actor.id, "quiz_passed", QUIZ_PASS_XP, `quiz_passed:${quizId}`, { quizId, score: result.score });
    xpAwarded = res.awarded;
    if (quiz.lessonId) await completeLessonFor(actor.id, quiz.lessonId);
  }

  const explanations: Record<string, I18nText> = {};
  for (const q of questions) if (q.explanation) explanations[q.id] = q.explanation;

  return {
    attemptId: attempt!.id,
    score: result.score,
    passed: result.passed,
    passScore: quiz.passScore,
    perQuestion: result.perQuestion,
    explanations,
    xpAwarded,
  };
}
