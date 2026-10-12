import "server-only";
import { and, count, eq, getDb, inArray, schema } from "@mufasa/db";
import { mergeRanges, type AyahCounts } from "@/lib/hifz-ranges";
import { forbidden } from "../errors";
import { childrenOf, type SessionUser } from "../session";

/** Shared lookups for the hifz / recitation / homework modules. */

export async function surahCounts(): Promise<AyahCounts> {
  const rows = await getDb()
    .select({ number: schema.quranSurahs.number, ayahCount: schema.quranSurahs.ayahCount })
    .from(schema.quranSurahs);
  return Object.fromEntries(rows.map((r) => [r.number, r.ayahCount]));
}

export type SurahInfo = { number: number; nameAr: string; nameEn: string; nameTranslit: string; ayahCount: number };

export async function listSurahs(): Promise<SurahInfo[]> {
  return getDb()
    .select({
      number: schema.quranSurahs.number,
      nameAr: schema.quranSurahs.nameAr,
      nameEn: schema.quranSurahs.nameEn,
      nameTranslit: schema.quranSurahs.nameTranslit,
      ayahCount: schema.quranSurahs.ayahCount,
    })
    .from(schema.quranSurahs)
    .orderBy(schema.quranSurahs.number);
}

/** Direct students plus members of the tutor's groups. */
export async function tutorStudentIds(tutorId: string): Promise<string[]> {
  const db = getDb();
  const [direct, grouped] = await Promise.all([
    db.select({ id: schema.tutorStudents.studentId }).from(schema.tutorStudents).where(eq(schema.tutorStudents.tutorId, tutorId)),
    db
      .select({ id: schema.classGroupMembers.studentId })
      .from(schema.classGroupMembers)
      .innerJoin(schema.classGroups, eq(schema.classGroups.id, schema.classGroupMembers.groupId))
      .where(eq(schema.classGroups.tutorId, tutorId)),
  ]);
  return [...new Set([...direct.map((r) => r.id), ...grouped.map((r) => r.id)])];
}

/** Child-safe display names: profile display name (first name) with the account name as fallback. */
export async function displayNames(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await getDb()
    .select({ id: schema.user.id, name: schema.user.name, displayName: schema.profiles.displayName })
    .from(schema.user)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.user.id))
    .where(inArray(schema.user.id, ids));
  return new Map(rows.map((r) => [r.id, r.displayName || r.name]));
}

export async function parentIdsOf(studentId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ id: schema.parentChildren.parentId })
    .from(schema.parentChildren)
    .where(eq(schema.parentChildren.childId, studentId));
  return rows.map((r) => r.id);
}

export type TutorStudentRow = {
  id: string;
  name: string;
  memorizedAyahs: number;
  pendingReviews: number;
  courses: number;
  openHomework: number;
};

/** Students a tutor teaches (direct + via groups) with quick stats. Admins see nobody here (use the admin panel). */
export async function listTutorStudents(actor: SessionUser): Promise<TutorStudentRow[]> {
  if (actor.role !== "tutor" && actor.role !== "admin") throw forbidden();
  const ids = actor.role === "tutor" ? await tutorStudentIds(actor.id) : [];
  if (!ids.length) return [];
  const db = getDb();
  const [names, memorized, pending, courses, submitted, hw] = await Promise.all([
    displayNames(ids),
    db
      .select({ studentId: schema.hifzEntries.studentId, surah: schema.hifzEntries.surah, from: schema.hifzEntries.ayahFrom, to: schema.hifzEntries.ayahTo })
      .from(schema.hifzEntries)
      .where(and(inArray(schema.hifzEntries.studentId, ids), eq(schema.hifzEntries.status, "memorized"))),
    db
      .select({ studentId: schema.recitationSubmissions.studentId, n: count() })
      .from(schema.recitationSubmissions)
      .where(and(inArray(schema.recitationSubmissions.studentId, ids), eq(schema.recitationSubmissions.status, "pending")))
      .groupBy(schema.recitationSubmissions.studentId),
    db
      .select({ studentId: schema.enrollments.userId, n: count() })
      .from(schema.enrollments)
      .where(inArray(schema.enrollments.userId, ids))
      .groupBy(schema.enrollments.userId),
    db
      .select({ studentId: schema.homeworkSubmissions.studentId, homeworkId: schema.homeworkSubmissions.homeworkId })
      .from(schema.homeworkSubmissions)
      .where(inArray(schema.homeworkSubmissions.studentId, ids)),
    // homework from this tutor still ahead of its due date: counted per student below
    db.select().from(schema.homework).where(eq(schema.homework.tutorId, actor.id)),
  ]);

  const byStudent = new Map<string, { surah: number; from: number; to: number }[]>();
  for (const m of memorized) {
    const list = byStudent.get(m.studentId) ?? [];
    list.push({ surah: m.surah, from: m.from, to: m.to });
    byStudent.set(m.studentId, list);
  }
  const pendingMap = new Map(pending.map((p) => [p.studentId, p.n]));
  const courseMap = new Map(courses.map((p) => [p.studentId, p.n]));
  const done = new Set(submitted.map((s) => `${s.homeworkId}:${s.studentId}`));

  // group membership for group homework
  const groupIds = [...new Set(hw.map((h) => h.groupId).filter((g): g is string => Boolean(g)))];
  const members = groupIds.length
    ? await db
        .select({ groupId: schema.classGroupMembers.groupId, studentId: schema.classGroupMembers.studentId })
        .from(schema.classGroupMembers)
        .where(inArray(schema.classGroupMembers.groupId, groupIds))
    : [];
  const open = new Map<string, number>();
  const now = Date.now();
  for (const h of hw) {
    if (h.dueAt.getTime() < now - 1000 * 60 * 60 * 24 * 30) continue;
    const targets = h.studentId ? [h.studentId] : members.filter((m) => m.groupId === h.groupId).map((m) => m.studentId);
    for (const s of targets) {
      if (!ids.includes(s) || done.has(`${h.id}:${s}`)) continue;
      open.set(s, (open.get(s) ?? 0) + 1);
    }
  }

  return ids
    .map((id) => ({
      id,
      name: names.get(id) ?? id,
      memorizedAyahs: mergeRanges(byStudent.get(id)?.map((r) => ({ surah: r.surah, from: r.from, to: r.to })) ?? []).reduce(
        (sum, r) => sum + (r.to - r.from + 1),
        0,
      ),
      pendingReviews: pendingMap.get(id) ?? 0,
      courses: courseMap.get(id) ?? 0,
      openHomework: open.get(id) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Children of a parent with display names (for the progress selector). */
export async function parentChildOptions(actor: SessionUser): Promise<{ id: string; name: string }[]> {
  if (actor.role !== "parent") throw forbidden();
  const ids = await childrenOf(actor.id);
  const names = await displayNames(ids);
  return ids.map((id) => ({ id, name: names.get(id) ?? id }));
}

