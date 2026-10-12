import "server-only";
import { and, desc, eq, getDb, schema, type HifzStatus } from "@mufasa/db";
import {
  coverageByJuz,
  coverageBySurah,
  intersectionSize,
  isValidRange,
  mergeRanges,
  planToRanges,
  rangeSize,
  totalAyahs,
  weekStart,
  weeklyPercent,
  type AyahCounts,
  type AyahRange,
  type JuzCoverage,
  type SurahCoverage,
} from "@/lib/hifz-ranges";
import { AppError, forbidden, notFound } from "../errors";
import { awardXp } from "../services/gamification";
import { canAccessStudent, isParentOf, isTutorOf, type SessionUser } from "../session";
import { surahCounts } from "./tutoring";

export const HIFZ_MEMORIZED_XP = 15;

type Actor = Pick<SessionUser, "id" | "role">;

// ───────────── Authorization ─────────────

/** Who may create plans / entries for a student: their tutor, their parent, an admin. */
async function assertCanManage(actor: Actor, studentId: string): Promise<"staff" | "parent"> {
  if (actor.role === "admin") return "staff";
  if (actor.role === "tutor" && (await isTutorOf(actor.id, studentId))) return "staff";
  if (actor.role === "parent" && (await isParentOf(actor.id, studentId))) return "parent";
  throw forbidden();
}

async function assertCanView(actor: Actor, studentId: string) {
  if (!(await canAccessStudent(actor as SessionUser, studentId))) throw forbidden();
}

function validRangeOrThrow(range: AyahRange, counts: AyahCounts) {
  if (!isValidRange(range, counts)) {
    throw new AppError("validation", "ayah range", { ayahTo: ["invalid_range"] });
  }
}

// ───────────── Plans ─────────────

export type PlanInput = {
  studentId: string;
  title: string;
  fromSurah: number;
  fromAyah: number;
  toSurah: number;
  toAyah: number | null;
  weeklyTarget: number;
  direction: "forward" | "backward";
  status?: "active" | "paused" | "completed";
};

function validatePlanBounds(p: Pick<PlanInput, "fromSurah" | "fromAyah" | "toSurah" | "toAyah">, counts: AyahCounts) {
  const fromMax = counts[p.fromSurah];
  const toMax = counts[p.toSurah];
  if (!fromMax || !toMax) throw new AppError("validation", "surah", { fromSurah: ["invalid_surah"] });
  if (p.fromAyah < 1 || p.fromAyah > fromMax) throw new AppError("validation", "fromAyah", { fromAyah: ["invalid_range"] });
  if (p.toAyah !== null && (p.toAyah < 1 || p.toAyah > toMax)) throw new AppError("validation", "toAyah", { toAyah: ["invalid_range"] });
  const sameSurahBackwards = p.fromSurah === p.toSurah && p.toAyah !== null && p.toAyah < p.fromAyah;
  if (p.toSurah < p.fromSurah || sameSurahBackwards) throw new AppError("validation", "range", { toSurah: ["invalid_range"] });
}

export async function createPlan(actor: Actor, input: PlanInput) {
  await assertCanManage(actor, input.studentId);
  validatePlanBounds(input, await surahCounts());
  const [row] = await getDb()
    .insert(schema.hifzPlans)
    .values({
      studentId: input.studentId,
      tutorId: actor.role === "tutor" ? actor.id : null,
      title: input.title,
      fromSurah: input.fromSurah,
      fromAyah: input.fromAyah,
      toSurah: input.toSurah,
      toAyah: input.toAyah,
      weeklyTarget: input.weeklyTarget,
      direction: input.direction,
      status: input.status ?? "active",
    })
    .returning({ id: schema.hifzPlans.id });
  return { id: row!.id };
}

async function loadPlan(planId: string) {
  const plan = await getDb().query.hifzPlans.findFirst({ where: eq(schema.hifzPlans.id, planId) });
  if (!plan) throw notFound();
  return plan;
}

export async function updatePlan(actor: Actor, planId: string, patch: Partial<Omit<PlanInput, "studentId">>) {
  const plan = await loadPlan(planId);
  await assertCanManage(actor, plan.studentId);
  const next = { ...plan, ...patch };
  validatePlanBounds(next, await surahCounts());
  await getDb()
    .update(schema.hifzPlans)
    .set({
      title: next.title,
      fromSurah: next.fromSurah,
      fromAyah: next.fromAyah,
      toSurah: next.toSurah,
      toAyah: next.toAyah,
      weeklyTarget: next.weeklyTarget,
      direction: next.direction,
      status: next.status,
    })
    .where(eq(schema.hifzPlans.id, planId));
  return { id: planId };
}

export async function deletePlan(actor: Actor, planId: string) {
  const plan = await loadPlan(planId);
  await assertCanManage(actor, plan.studentId);
  await getDb().delete(schema.hifzPlans).where(eq(schema.hifzPlans.id, planId));
  return { id: planId };
}

export async function listPlans(actor: Actor, studentId: string) {
  await assertCanView(actor, studentId);
  return getDb().select().from(schema.hifzPlans).where(eq(schema.hifzPlans.studentId, studentId)).orderBy(desc(schema.hifzPlans.createdAt));
}

// ───────────── Entries ─────────────

export type EntryInput = {
  studentId: string;
  planId?: string | null;
  surah: number;
  ayahFrom: number;
  ayahTo: number;
  status?: HifzStatus;
  grade?: number | null;
  note?: string | null;
};

/** Awards the memorization XP once per entry (refKey = entry id). */
async function onMemorized(studentId: string, entryId: string, range: AyahRange) {
  await awardXp(studentId, "hifz_memorized", HIFZ_MEMORIZED_XP, `hifz_memorized:${entryId}`, {
    surah: range.surah,
    ayahFrom: range.from,
    ayahTo: range.to,
  });
}

export async function createEntry(actor: Actor, input: EntryInput) {
  const who = await assertCanManage(actor, input.studentId);
  const counts = await surahCounts();
  const range = { surah: input.surah, from: input.ayahFrom, to: input.ayahTo };
  validRangeOrThrow(range, counts);

  const status: HifzStatus = who === "staff" ? (input.status ?? "learning") : "learning";
  const grade = who === "staff" ? (input.grade ?? null) : null;
  if (input.planId) {
    const plan = await loadPlan(input.planId);
    if (plan.studentId !== input.studentId) throw forbidden();
  }
  const [row] = await getDb()
    .insert(schema.hifzEntries)
    .values({
      studentId: input.studentId,
      planId: input.planId ?? null,
      surah: input.surah,
      ayahFrom: input.ayahFrom,
      ayahTo: input.ayahTo,
      status,
      grade,
      tutorId: actor.role === "tutor" ? actor.id : null,
      note: input.note ?? null,
      lastReviewedAt: status === "learning" ? null : new Date(),
    })
    .returning({ id: schema.hifzEntries.id });
  if (status === "memorized") await onMemorized(input.studentId, row!.id, range);
  return { id: row!.id };
}

async function loadEntry(entryId: string) {
  const entry = await getDb().query.hifzEntries.findFirst({ where: eq(schema.hifzEntries.id, entryId) });
  if (!entry) throw notFound();
  return entry;
}

export type EntryPatch = {
  status?: HifzStatus;
  grade?: number | null;
  note?: string | null;
  ayahFrom?: number;
  ayahTo?: number;
};

/** Status transitions and grades are tutor/admin only; parents may only edit the note and range. */
export async function updateEntry(actor: Actor, entryId: string, patch: EntryPatch) {
  const entry = await loadEntry(entryId);
  const who = await assertCanManage(actor, entry.studentId);
  if (who !== "staff" && (patch.status !== undefined || patch.grade !== undefined)) throw forbidden();

  if (
    who !== "staff" &&
    entry.status === "memorized" &&
    ((patch.ayahFrom !== undefined && patch.ayahFrom !== entry.ayahFrom) ||
      (patch.ayahTo !== undefined && patch.ayahTo !== entry.ayahTo) ||
      ("surah" in patch && (patch as { surah?: number }).surah !== undefined))
  ) {
    throw forbidden();
  }

  const ayahFrom = patch.ayahFrom ?? entry.ayahFrom;
  const ayahTo = patch.ayahTo ?? entry.ayahTo;
  validRangeOrThrow({ surah: entry.surah, from: ayahFrom, to: ayahTo }, await surahCounts());

  const status = patch.status ?? entry.status;
  const becameMemorized = status === "memorized" && entry.status !== "memorized";
  await getDb()
    .update(schema.hifzEntries)
    .set({
      ayahFrom,
      ayahTo,
      status,
      grade: patch.grade === undefined ? entry.grade : patch.grade,
      note: patch.note === undefined ? entry.note : patch.note,
      tutorId: actor.role === "tutor" ? actor.id : entry.tutorId,
      lastReviewedAt: patch.status !== undefined && patch.status !== "learning" ? new Date() : entry.lastReviewedAt,
    })
    .where(eq(schema.hifzEntries.id, entryId));
  if (becameMemorized) await onMemorized(entry.studentId, entryId, { surah: entry.surah, from: ayahFrom, to: ayahTo });
  return { id: entryId };
}

export async function deleteEntry(actor: Actor, entryId: string) {
  const entry = await loadEntry(entryId);
  await assertCanManage(actor, entry.studentId);
  await getDb().delete(schema.hifzEntries).where(eq(schema.hifzEntries.id, entryId));
  return { id: entryId };
}

export async function listEntries(actor: Actor, studentId: string) {
  await assertCanView(actor, studentId);
  return getDb()
    .select()
    .from(schema.hifzEntries)
    .where(eq(schema.hifzEntries.studentId, studentId))
    .orderBy(desc(schema.hifzEntries.updatedAt));
}

/** Entries a recitation can be linked to (not yet memorized first). */
export async function openEntriesForStudent(actor: Actor, studentId: string) {
  await assertCanView(actor, studentId);
  return getDb()
    .select()
    .from(schema.hifzEntries)
    .where(and(eq(schema.hifzEntries.studentId, studentId)))
    .orderBy(desc(schema.hifzEntries.updatedAt))
    .limit(100);
}

// ───────────── Overview ─────────────

export type HifzOverview = {
  studentId: string;
  totals: { memorized: number; learning: number; needsReview: number; total: number; percent: number };
  surahs: (SurahCoverage & { learning: number; needsReview: number })[];
  juz: JuzCoverage[];
  activePlan: {
    plan: typeof schema.hifzPlans.$inferSelect;
    planTotal: number;
    planDone: number;
    planPercent: number;
    weeklyDone: number;
    weeklyTarget: number;
    weeklyPercent: number;
  } | null;
  plans: (typeof schema.hifzPlans.$inferSelect)[];
  entries: (typeof schema.hifzEntries.$inferSelect)[];
};

const toRange = (e: { surah: number; ayahFrom: number; ayahTo: number }): AyahRange => ({
  surah: e.surah,
  from: e.ayahFrom,
  to: e.ayahTo,
});

const sumRanges = (rs: AyahRange[]) => mergeRanges(rs).reduce((n, r) => n + rangeSize(r), 0);

export async function hifzOverview(actor: Actor, studentId: string, now = new Date()): Promise<HifzOverview> {
  await assertCanView(actor, studentId);
  const db = getDb();
  const [counts, entries, plans] = await Promise.all([
    surahCounts(),
    db.select().from(schema.hifzEntries).where(eq(schema.hifzEntries.studentId, studentId)).orderBy(desc(schema.hifzEntries.updatedAt)),
    db.select().from(schema.hifzPlans).where(eq(schema.hifzPlans.studentId, studentId)).orderBy(desc(schema.hifzPlans.createdAt)),
  ]);

  const memorized = entries.filter((e) => e.status === "memorized").map(toRange);
  const learning = entries.filter((e) => e.status === "learning").map(toRange);
  const needsReview = entries.filter((e) => e.status === "needs_review").map(toRange);

  const memCoverage = coverageBySurah(memorized, counts);
  const learnCov = new Map(coverageBySurah(learning, counts).map((c) => [c.surah, c.memorized]));
  const reviewCov = new Map(coverageBySurah(needsReview, counts).map((c) => [c.surah, c.memorized]));
  const surahNumbers = new Set([...memCoverage.map((c) => c.surah), ...learnCov.keys(), ...reviewCov.keys()]);
  const surahs = [...surahNumbers]
    .sort((a, b) => a - b)
    .map((surah) => {
      const base = memCoverage.find((c) => c.surah === surah) ?? { surah, memorized: 0, total: counts[surah] ?? 0, percent: 0 };
      return { ...base, learning: learnCov.get(surah) ?? 0, needsReview: reviewCov.get(surah) ?? 0 };
    });

  const memorizedTotal = sumRanges(memorized);
  const total = totalAyahs(counts);

  const active = plans.find((p) => p.status === "active") ?? null;
  let activePlan: HifzOverview["activePlan"] = null;
  if (active) {
    const planRanges = planToRanges(active, counts);
    const planTotal = sumRanges(planRanges);
    const planDone = intersectionSize(planRanges, memorized);
    const since = weekStart(now);
    // Approximation: ayahs of entries that were marked memorized (or updated) this week.
    const weeklyDone = sumRanges(entries.filter((e) => e.status === "memorized" && e.updatedAt >= since).map(toRange));
    activePlan = {
      plan: active,
      planTotal,
      planDone,
      planPercent: planTotal ? Math.round((planDone / planTotal) * 100) : 0,
      weeklyDone,
      weeklyTarget: active.weeklyTarget,
      weeklyPercent: weeklyPercent(weeklyDone, active.weeklyTarget),
    };
  }

  return {
    studentId,
    totals: {
      memorized: memorizedTotal,
      learning: sumRanges(learning),
      needsReview: sumRanges(needsReview),
      total,
      percent: total ? Math.round((memorizedTotal / total) * 1000) / 10 : 0,
    },
    surahs,
    juz: coverageByJuz(memorized, counts),
    activePlan,
    plans,
    entries,
  };
}
