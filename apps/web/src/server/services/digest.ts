import "server-only";
import { and, eq, getDb, gte, inArray, lt, or, schema } from "@mufasa/db";
import { brand } from "@mufasa/config/brand";
import { isRtl, t18n } from "@mufasa/config/locales";
import { createTranslator } from "next-intl";
import { loaders, type Messages } from "@messages/index";
import { env } from "@/env";
import { escapeHtml, hasActivity, summarizeChildWeek, digestWindow, type ChildDigest, type DigestRows } from "@/lib/digest";
import { sendEmail } from "../email";
import { isEnabled } from "../flags";

// TODO(opt-out): there is no per-user preference column yet. The global switch is the
// `weekly_digest` feature flag; a per-parent opt-out needs a settings column or table.

type Locale = "en" | "ar" | "tr";
const asLocale = (v: string | null | undefined): Locale => (v === "ar" || v === "tr" ? v : "en");

// ───────────── Rendering (pure given translated messages) ─────────────

export type DigestChild = { name: string; digest: ChildDigest };

export async function renderDigestEmail(input: {
  locale: Locale;
  parentName: string;
  children: DigestChild[];
  dashboardUrl: string;
}): Promise<{ subject: string; html: string; text: string }> {
  const messages: Messages = (await loaders[input.locale]()).default;
  const t = createTranslator({ locale: input.locale, messages, namespace: "email" });
  const rtl = isRtl(input.locale);
  const align = rtl ? "right" : "left";
  const opposite = rtl ? "left" : "right";

  const rowsFor = (d: ChildDigest): [string, string][] => {
    const rows: [string, string][] = [
      [t("lessonsCompleted"), String(d.lessonsCompleted)],
      [t("xpGained"), String(d.xpGained)],
      [t("streak"), t("streakDays", { count: d.streak })],
    ];
    if (d.badges.length) rows.push([t("badgesEarned"), d.badges.join(", ")]);
    if (d.ayahsMemorized) rows.push([t("ayahsMemorized"), String(d.ayahsMemorized)]);
    if (d.recitationsSubmitted || d.recitationsReviewed) {
      rows.push([t("recitationsSubmitted"), String(d.recitationsSubmitted)]);
      rows.push([t("recitationsReviewed"), String(d.recitationsReviewed)]);
    }
    if (d.homeworkDue) rows.push([t("homework"), t("homeworkValue", { submitted: d.homeworkSubmitted, due: d.homeworkDue })]);
    if (d.classesAttended || d.classesMissed) {
      rows.push([t("classesAttended"), String(d.classesAttended)]);
      rows.push([t("classesMissed"), String(d.classesMissed)]);
    }
    return rows;
  };

  const sections = input.children.map((c) => ({ name: c.name, rows: rowsFor(c.digest) }));

  const childHtml = sections
    .map(
      (s) => `
      <tr><td style="padding:20px 24px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;">
          <tr><td colspan="2" style="padding:12px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:16px;font-weight:700;text-align:${align};">${escapeHtml(s.name)}</td></tr>
          ${s.rows
            .map(
              ([label, value]) =>
                `<tr><td style="padding:8px 16px;font-size:14px;color:#4b5563;text-align:${align};">${escapeHtml(label)}</td><td style="padding:8px 16px;font-size:14px;font-weight:600;color:#111827;text-align:${opposite};">${escapeHtml(value)}</td></tr>`,
            )
            .join("")}
        </table>
      </td></tr>`,
    )
    .join("");

  const subject = `${brand.name}: ${t("digestSubject")}`;
  const html = `<!doctype html>
<html lang="${input.locale}" dir="${rtl ? "rtl" : "ltr"}">
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(t("digestPreheader"))}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${rtl ? "rtl" : "ltr"}" style="background:#f3f4f6;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;">
        <tr><td style="padding:24px 24px 0;font-size:13px;font-weight:700;letter-spacing:1px;color:#6b7280;text-align:${align};">${escapeHtml(brand.name.toUpperCase())}</td></tr>
        <tr><td style="padding:8px 24px 0;font-size:20px;font-weight:700;text-align:${align};">${escapeHtml(t("digestGreeting", { name: input.parentName }))}</td></tr>
        <tr><td style="padding:8px 24px 0;font-size:14px;color:#4b5563;text-align:${align};">${escapeHtml(t("digestIntro"))}</td></tr>
        ${childHtml}
        <tr><td align="${align}" style="padding:24px;">
          <a href="${escapeHtml(input.dashboardUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 20px;border-radius:8px;">${escapeHtml(t("openDashboard"))}</a>
        </td></tr>
        <tr><td style="padding:0 24px 24px;font-size:12px;color:#9ca3af;text-align:${align};">${escapeHtml(t("footer", { academy: brand.name }))}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    t("digestGreeting", { name: input.parentName }),
    t("digestIntro"),
    ...sections.flatMap((s) => ["", s.name, ...s.rows.map(([l, v]) => `- ${l}: ${v}`)]),
    "",
    `${t("openDashboard")}: ${input.dashboardUrl}`,
  ].join("\n");

  return { subject, html, text };
}

// ───────────── Data + sending ─────────────

export type DigestRunResult = { enabled: boolean; parents: number; sent: number; skipped: number; failed: number };

export async function runWeeklyDigest(now = new Date()): Promise<DigestRunResult> {
  const result: DigestRunResult = { enabled: true, parents: 0, sent: 0, skipped: 0, failed: 0 };
  if (!(await isEnabled("weekly_digest"))) return { ...result, enabled: false };

  const db = getDb();
  const w = digestWindow(now);

  const links = await db
    .select({
      parentId: schema.parentChildren.parentId,
      childId: schema.parentChildren.childId,
      parentName: schema.user.name,
      parentEmail: schema.user.email,
      parentLocale: schema.user.locale,
      parentBanned: schema.user.banned,
    })
    .from(schema.parentChildren)
    .innerJoin(schema.user, eq(schema.user.id, schema.parentChildren.parentId));
  if (links.length === 0) return result;

  const childIds = [...new Set(links.map((l) => l.childId))];
  const data = await loadChildRows(childIds, w);

  const byParent = new Map<string, { name: string; email: string; locale: Locale; banned: boolean; children: string[] }>();
  for (const l of links) {
    const p = byParent.get(l.parentId) ?? {
      name: l.parentName,
      email: l.parentEmail,
      locale: asLocale(l.parentLocale),
      banned: Boolean(l.parentBanned),
      children: [],
    };
    p.children.push(l.childId);
    byParent.set(l.parentId, p);
  }

  for (const parent of byParent.values()) {
    result.parents++;
    try {
      if (parent.banned || parent.email.endsWith("@kids.invalid")) {
        result.skipped++;
        continue;
      }
      const children: DigestChild[] = [];
      for (const childId of parent.children) {
        const rows = data.get(childId);
        if (!rows) continue;
        const digest = summarizeChildWeek(
          { ...rows.rows, badges: rows.badges.map((b) => ({ name: t18n(b.name, parent.locale), awardedAt: b.awardedAt })) },
          w,
        );
        if (hasActivity(digest)) children.push({ name: rows.firstName, digest });
      }
      if (children.length === 0) {
        result.skipped++;
        continue;
      }
      const mail = await renderDigestEmail({
        locale: parent.locale,
        parentName: parent.name.split(" ")[0] ?? parent.name,
        children,
        dashboardUrl: `${env().APP_URL.replace(/\/$/, "")}/${parent.locale}/parent/progress`,
      });
      await sendEmail({ to: parent.email, ...mail });
      result.sent++;
    } catch (err) {
      result.failed++;
      console.error("[digest] failed for a parent", err);
    }
  }
  return result;
}

type ChildData = {
  firstName: string;
  rows: Omit<DigestRows, "badges">;
  badges: { name: { en: string; ar?: string; tr?: string }; awardedAt: Date }[];
};

/** One batched query per table for all children, then split by child. */
async function loadChildRows(childIds: string[], w: { from: Date; to: Date }): Promise<Map<string, ChildData>> {
  const db = getDb();

  const [profiles, users, lessons, xp, streaks, badgeRows, hifz, recitations, memberships, attendance] = await Promise.all([
    db
      .select({ userId: schema.profiles.userId, displayName: schema.profiles.displayName })
      .from(schema.profiles)
      .where(inArray(schema.profiles.userId, childIds)),
    db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(inArray(schema.user.id, childIds)),
    db
      .select({ userId: schema.lessonProgress.userId, completedAt: schema.lessonProgress.completedAt })
      .from(schema.lessonProgress)
      .where(and(inArray(schema.lessonProgress.userId, childIds), gte(schema.lessonProgress.completedAt, w.from))),
    db
      .select({ userId: schema.xpEvents.userId, amount: schema.xpEvents.amount, createdAt: schema.xpEvents.createdAt })
      .from(schema.xpEvents)
      .where(and(inArray(schema.xpEvents.userId, childIds), gte(schema.xpEvents.createdAt, w.from))),
    db
      .select({ userId: schema.streaks.userId, current: schema.streaks.current })
      .from(schema.streaks)
      .where(inArray(schema.streaks.userId, childIds)),
    db
      .select({ userId: schema.userBadges.userId, name: schema.badges.name, awardedAt: schema.userBadges.awardedAt })
      .from(schema.userBadges)
      .innerJoin(schema.badges, eq(schema.badges.id, schema.userBadges.badgeId))
      .where(and(inArray(schema.userBadges.userId, childIds), gte(schema.userBadges.awardedAt, w.from))),
    db
      .select({
        studentId: schema.hifzEntries.studentId,
        status: schema.hifzEntries.status,
        ayahFrom: schema.hifzEntries.ayahFrom,
        ayahTo: schema.hifzEntries.ayahTo,
        updatedAt: schema.hifzEntries.updatedAt,
      })
      .from(schema.hifzEntries)
      .where(and(inArray(schema.hifzEntries.studentId, childIds), eq(schema.hifzEntries.status, "memorized"), gte(schema.hifzEntries.updatedAt, w.from))),
    db
      .select({
        studentId: schema.recitationSubmissions.studentId,
        createdAt: schema.recitationSubmissions.createdAt,
        reviewedAt: schema.recitationSubmissions.reviewedAt,
        status: schema.recitationSubmissions.status,
      })
      .from(schema.recitationSubmissions)
      .where(
        and(
          inArray(schema.recitationSubmissions.studentId, childIds),
          or(gte(schema.recitationSubmissions.createdAt, w.from), gte(schema.recitationSubmissions.reviewedAt, w.from)),
        ),
      ),
    db
      .select({ groupId: schema.classGroupMembers.groupId, studentId: schema.classGroupMembers.studentId })
      .from(schema.classGroupMembers)
      .where(inArray(schema.classGroupMembers.studentId, childIds)),
    db
      .select({ studentId: schema.sessionAttendees.studentId, status: schema.sessionAttendees.status, startsAt: schema.classSessions.startsAt })
      .from(schema.sessionAttendees)
      .innerJoin(schema.classSessions, eq(schema.classSessions.id, schema.sessionAttendees.sessionId))
      .where(
        and(
          inArray(schema.sessionAttendees.studentId, childIds),
          gte(schema.classSessions.startsAt, w.from),
          lt(schema.classSessions.startsAt, w.to),
        ),
      ),
  ]);

  const groupIds = [...new Set(memberships.map((m) => m.groupId))];
  const homeworkRows = await db
    .select({ id: schema.homework.id, studentId: schema.homework.studentId, groupId: schema.homework.groupId, dueAt: schema.homework.dueAt })
    .from(schema.homework)
    .where(
      and(
        gte(schema.homework.dueAt, w.from),
        lt(schema.homework.dueAt, w.to),
        groupIds.length
          ? or(inArray(schema.homework.studentId, childIds), inArray(schema.homework.groupId, groupIds))
          : inArray(schema.homework.studentId, childIds),
      ),
    );
  const submissions = homeworkRows.length
    ? await db
        .select({ homeworkId: schema.homeworkSubmissions.homeworkId, studentId: schema.homeworkSubmissions.studentId, submittedAt: schema.homeworkSubmissions.submittedAt })
        .from(schema.homeworkSubmissions)
        .where(and(inArray(schema.homeworkSubmissions.homeworkId, homeworkRows.map((h) => h.id)), inArray(schema.homeworkSubmissions.studentId, childIds)))
    : [];

  const out = new Map<string, ChildData>();
  const nameOf = new Map(profiles.map((p) => [p.userId, p.displayName]));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  for (const id of childIds) {
    // child safety: first name only in anything that leaves the app
    const full = nameOf.get(id) || userName.get(id) || "";
    out.set(id, {
      firstName: full.trim().split(/\s+/)[0] ?? full,
      rows: {
        lessonCompletions: [],
        xpEvents: [],
        streak: null,
        hifzEntries: [],
        recitations: [],
        homework: [],
        attendance: [],
      },
      badges: [],
    });
  }
  for (const r of lessons) out.get(r.userId)?.rows.lessonCompletions.push(r.completedAt);
  for (const r of xp) out.get(r.userId)?.rows.xpEvents.push({ amount: r.amount, createdAt: r.createdAt });
  for (const r of streaks) {
    const c = out.get(r.userId);
    if (c) c.rows.streak = { current: r.current };
  }
  for (const r of badgeRows) out.get(r.userId)?.badges.push({ name: r.name, awardedAt: r.awardedAt });
  for (const r of hifz) out.get(r.studentId)?.rows.hifzEntries.push(r);
  for (const r of recitations) out.get(r.studentId)?.rows.recitations.push(r);
  for (const r of attendance) out.get(r.studentId)?.rows.attendance.push({ status: r.status, startsAt: r.startsAt });

  const submittedAt = new Map(submissions.map((s) => [`${s.homeworkId}:${s.studentId}`, s.submittedAt]));
  for (const id of childIds) {
    const myGroups = new Set(memberships.filter((m) => m.studentId === id).map((m) => m.groupId));
    for (const h of homeworkRows) {
      if (h.studentId === id || (h.groupId && myGroups.has(h.groupId))) {
        out.get(id)?.rows.homework.push({ dueAt: h.dueAt, submittedAt: submittedAt.get(`${h.id}:${id}`) ?? null });
      }
    }
  }
  return out;
}
