/**
 * certificate_pdf: renders the landscape A4 certificate for one `certificates`
 * row, uploads it to the private `certificates` bucket and stores pdfPath.
 */
import { z } from "zod";
import { eq, schema } from "@mufasa/db";
import { t18n } from "@mufasa/config/locales";
import { BUCKET, PermanentJobError, type WorkerContext } from "../context";
import { renderCertificatePdf, type CertificateLocale } from "../lib/certificate-pdf";
import { register, type Job } from "./index";

const payloadSchema = z.object({ certificateId: z.string().uuid() });

function asLocale(v: string | null | undefined): CertificateLocale {
  return v === "ar" || v === "tr" ? v : "en";
}

async function certificatePdf(job: Job, ctx: WorkerContext) {
  const { certificateId } = payloadSchema.parse(job.payload);
  if (!ctx.supabase) throw new PermanentJobError("Supabase storage is not configured on the worker");
  const db = ctx.db;

  const [cert] = await db.select().from(schema.certificates).where(eq(schema.certificates.id, certificateId));
  if (!cert) throw new PermanentJobError(`certificate ${certificateId} not found`);
  const [u] = await db.select({ locale: schema.user.locale }).from(schema.user).where(eq(schema.user.id, cert.userId));
  const locale = asLocale(u?.locale);

  let courseTitle: string | null = null;
  if (cert.courseId) {
    const [course] = await db.select({ title: schema.courses.title }).from(schema.courses).where(eq(schema.courses.id, cert.courseId));
    if (course) courseTitle = t18n(course.title, locale);
  }
  await ctx.progress(20);

  const pdf = await renderCertificatePdf({
    locale,
    title: t18n(cert.title, locale),
    recipientName: cert.recipientName,
    courseTitle,
    issuedAt: cert.issuedAt,
    code: cert.code,
    verifyUrl: `${ctx.env.appUrl.replace(/\/$/, "")}/verify-cert/${cert.code}`,
  });
  await ctx.progress(70);

  const objectPath = `certificates/${cert.userId}/${cert.code}.pdf`;
  const { error } = await ctx.supabase.storage
    .from(BUCKET.certificates)
    .upload(objectPath, pdf, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`upload ${objectPath} failed: ${error.message}`);

  await db.update(schema.certificates).set({ pdfPath: objectPath }).where(eq(schema.certificates.id, certificateId));
  return { pdfPath: objectPath, bytes: pdf.length };
}

register("certificate_pdf", certificatePdf);
