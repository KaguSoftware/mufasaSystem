import "server-only";
import { z } from "zod";
import { and, count, desc, eq, getDb, ilike, isDbConfigured, isNull, or, schema, DbNotConfiguredError } from "@mufasa/db";
import type { I18nText } from "@mufasa/config/locales";
import { firstName, normalizeCode } from "@/lib/certificate-code";
import { audit } from "../audit";
import { AppError, forbidden, notFound } from "../errors";
import { issueCertificate } from "../services/certificates";
import { canAccessStudent, type SessionUser } from "../session";
import { storage } from "../storage";

export const CERTIFICATES_PAGE_SIZE = 20;
const DOWNLOAD_URL_TTL_SEC = 5 * 60;

export type CertificateItem = {
  id: string;
  code: string;
  title: I18nText;
  issuedAt: Date;
  revoked: boolean;
  pdfReady: boolean;
};

// ───────────── Student / family ─────────────

export async function myCertificates(actor: SessionUser, studentId: string): Promise<CertificateItem[]> {
  if (!(await canAccessStudent(actor, studentId))) throw forbidden();
  const rows = await getDb()
    .select()
    .from(schema.certificates)
    .where(eq(schema.certificates.userId, studentId))
    .orderBy(desc(schema.certificates.issuedAt));
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    issuedAt: r.issuedAt,
    revoked: Boolean(r.revokedAt),
    pdfReady: Boolean(r.pdfPath),
  }));
}

export type CertificateDownload = { status: "ready"; url: string } | { status: "pending" };

/** Owner, parent, tutor of the student or admin. Revoked certificates are not downloadable (admins excepted). */
export async function certificateDownloadUrl(actor: SessionUser, id: string): Promise<CertificateDownload> {
  const cert = await getDb().query.certificates.findFirst({ where: eq(schema.certificates.id, id) });
  if (!cert) throw notFound();
  if (!(await canAccessStudent(actor, cert.userId))) throw forbidden();
  if (cert.revokedAt && actor.role !== "admin") throw notFound();
  if (!cert.pdfPath) return { status: "pending" };
  return { status: "ready", url: await storage().signedUrl("certificates", cert.pdfPath, DOWNLOAD_URL_TTL_SEC) };
}

// ───────────── Admin ─────────────

function requireAdmin(actor: SessionUser) {
  if (actor.role !== "admin") throw forbidden();
}

export type AdminCertificateRow = {
  id: string;
  code: string;
  title: I18nText;
  recipientName: string;
  userId: string;
  userName: string;
  userEmail: string;
  issuedAt: Date;
  revokedAt: Date | null;
  pdfReady: boolean;
};

export async function listCertificates(
  actor: SessionUser,
  opts: { q?: string; page?: number } = {},
): Promise<{ rows: AdminCertificateRow[]; total: number; page: number; pageSize: number }> {
  requireAdmin(actor);
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const q = opts.q?.trim();
  const like = q ? `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
  const where = like
    ? or(
        ilike(schema.user.name, like),
        ilike(schema.user.email, like),
        ilike(schema.user.username, like),
        ilike(schema.certificates.recipientName, like),
        ilike(schema.certificates.code, like),
      )
    : undefined;
  const db = getDb();
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: schema.certificates.id,
        code: schema.certificates.code,
        title: schema.certificates.title,
        recipientName: schema.certificates.recipientName,
        userId: schema.certificates.userId,
        userName: schema.user.name,
        userEmail: schema.user.email,
        issuedAt: schema.certificates.issuedAt,
        revokedAt: schema.certificates.revokedAt,
        pdfPath: schema.certificates.pdfPath,
      })
      .from(schema.certificates)
      .innerJoin(schema.user, eq(schema.user.id, schema.certificates.userId))
      .where(where)
      .orderBy(desc(schema.certificates.issuedAt))
      .limit(CERTIFICATES_PAGE_SIZE)
      .offset((page - 1) * CERTIFICATES_PAGE_SIZE),
    db
      .select({ n: count() })
      .from(schema.certificates)
      .innerJoin(schema.user, eq(schema.user.id, schema.certificates.userId))
      .where(where),
  ]);
  return {
    rows: rows.map(({ pdfPath, ...r }) => ({ ...r, userEmail: r.userEmail.endsWith("@kids.invalid") ? "" : r.userEmail, pdfReady: Boolean(pdfPath) })),
    total: total?.n ?? 0,
    page,
    pageSize: CERTIFICATES_PAGE_SIZE,
  };
}

const i18nInput = z.object({
  en: z.string().trim().min(1).max(200),
  ar: z.string().trim().max(200).optional(),
  tr: z.string().trim().max(200).optional(),
});

export const issueManualSchema = z.object({
  /** Email or username of the recipient. */
  userRef: z.string().trim().min(1).max(200),
  title: i18nInput,
  courseId: z.string().uuid().optional(),
});
export type IssueManualInput = z.infer<typeof issueManualSchema>;

function cleanI18n(t: z.infer<typeof i18nInput>): I18nText {
  return { en: t.en, ...(t.ar ? { ar: t.ar } : {}), ...(t.tr ? { tr: t.tr } : {}) };
}

export async function issueManual(actor: SessionUser, input: IssueManualInput) {
  requireAdmin(actor);
  const db = getDb();
  const ref = input.userRef.trim();
  const target = await db.query.user.findFirst({
    where: or(eq(schema.user.email, ref.toLowerCase()), eq(schema.user.username, ref.toLowerCase())),
    columns: { id: true },
  });
  if (!target) throw new AppError("not_found", "user", { userRef: ["not_found"] });

  const { certificate, created } = await issueCertificate({
    userId: target.id,
    courseId: input.courseId ?? null,
    title: cleanI18n(input.title),
    issuedBy: actor.id,
  });
  if (created) {
    await audit({
      actorId: actor.id,
      action: "certificate.issue",
      entity: "certificates",
      entityId: certificate.id,
      after: { userId: target.id, code: certificate.code, courseId: certificate.courseId },
    });
  }
  return { id: certificate.id, code: certificate.code, created };
}

export const revokeSchema = z.object({ id: z.string().uuid(), reason: z.string().trim().min(3).max(500) });

export async function revoke(actor: SessionUser, id: string, reason: string) {
  requireAdmin(actor);
  const db = getDb();
  const cert = await db.query.certificates.findFirst({ where: eq(schema.certificates.id, id) });
  if (!cert) throw notFound();
  if (cert.revokedAt) return { id, alreadyRevoked: true as const };
  await db
    .update(schema.certificates)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.certificates.id, id), isNull(schema.certificates.revokedAt)));
  await audit({
    actorId: actor.id,
    action: "certificate.revoke",
    entity: "certificates",
    entityId: id,
    before: { code: cert.code, revokedAt: null },
    after: { revoked: true, reason },
  });
  return { id, alreadyRevoked: false as const };
}

// ───────────── Public verification ─────────────

export type PublicCertificate = {
  recipientFirstName: string;
  title: I18nText;
  issuedAt: Date;
  status: "valid" | "revoked";
};

/**
 * No session needed. Returns minimal info only (first name, title, date, status),
 * and null for unknown codes, malformed codes or when the database is not connected.
 */
export async function verifyCertificate(code: string): Promise<PublicCertificate | null> {
  const normalized = normalizeCode(code);
  if (!normalized || !isDbConfigured()) return null;
  try {
    const row = await getDb().query.certificates.findFirst({
      where: eq(schema.certificates.code, normalized),
      columns: { recipientName: true, title: true, issuedAt: true, revokedAt: true },
    });
    if (!row) return null;
    return {
      recipientFirstName: firstName(row.recipientName),
      title: row.title,
      issuedAt: row.issuedAt,
      status: row.revokedAt ? "revoked" : "valid",
    };
  } catch (err) {
    if (err instanceof DbNotConfiguredError) return null;
    throw err;
  }
}
