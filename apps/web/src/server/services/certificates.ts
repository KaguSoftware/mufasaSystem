import "server-only";
import { and, eq, getDb, isNull, schema } from "@mufasa/db";
import { t18n, type I18nText } from "@mufasa/config/locales";
import { generateCode, recipientNameFor } from "@/lib/certificate-code";
import { isMinor } from "@/lib/minor";
import { AppError } from "../errors";
import { enqueueJob } from "../jobs";
import { notify } from "../notify";

export type IssueCertificateInput = {
  userId: string;
  courseId?: string | null;
  title: I18nText;
  issuedBy?: string | null;
};

type CertificateRow = typeof schema.certificates.$inferSelect;

/**
 * Issues a certificate and queues its PDF. Course certificates are idempotent per
 * (userId, courseId): an existing non-revoked certificate is returned as is.
 * Child safety: minors get their first name only on the certificate.
 */
export async function issueCertificate(input: IssueCertificateInput): Promise<{ certificate: CertificateRow; created: boolean }> {
  const db = getDb();
  const courseId = input.courseId ?? null;

  if (courseId) {
    const existing = await db.query.certificates.findFirst({
      where: and(
        eq(schema.certificates.userId, input.userId),
        eq(schema.certificates.courseId, courseId),
        isNull(schema.certificates.revokedAt),
      ),
    });
    if (existing) {
      if (!existing.pdfPath) await queuePdf(existing.id);
      return { certificate: existing, created: false };
    }
  }

  const [u, profile] = await Promise.all([
    db.query.user.findFirst({
      where: eq(schema.user.id, input.userId),
      columns: { id: true, name: true, role: true, locale: true, isManagedChild: true },
    }),
    db.query.profiles.findFirst({
      where: eq(schema.profiles.userId, input.userId),
      columns: { displayName: true, birthYear: true },
    }),
  ]);
  if (!u) throw new AppError("not_found", "user");

  const minor = isMinor({ isManagedChild: u.isManagedChild, birthYear: profile?.birthYear, role: u.role });
  const recipientName = recipientNameFor(profile?.displayName || u.name, minor);

  // The code column is unique: retry on the (very unlikely) collision.
  let row: CertificateRow | undefined;
  for (let attempt = 0; attempt < 5 && !row; attempt++) {
    [row] = await db
      .insert(schema.certificates)
      .values({
        userId: input.userId,
        courseId,
        code: generateCode(),
        title: input.title,
        recipientName,
        issuedBy: input.issuedBy ?? null,
      })
      .onConflictDoNothing({ target: schema.certificates.code })
      .returning();
  }
  if (!row) throw new AppError("internal", "certificate code generation failed");

  await queuePdf(row.id);
  await notify(
    input.userId,
    "certificateIssued",
    { course: t18n(input.title, u.locale) },
    "/student/certificates",
  );
  return { certificate: row, created: true };
}

function queuePdf(certificateId: string) {
  return enqueueJob("certificate_pdf", { certificateId }, { dedupeKey: `certificate_pdf:${certificateId}` });
}
