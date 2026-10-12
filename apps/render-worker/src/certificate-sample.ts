/**
 * Offline smoke test: renders sample certificates (en, ar, tr) to render-output/.
 * No database, storage or network.
 *
 *   pnpm --filter render-worker certificate:sample
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderCertificatePdf, type CertificateData } from "./lib/certificate-pdf";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../render-output");

const base = { issuedAt: new Date("2026-10-12T10:00:00Z"), code: "K7MP-2XQ9-HT", verifyUrl: "http://localhost:3000/verify-cert/K7MP-2XQ9-HT" };

const samples: Record<string, CertificateData> = {
  en: { ...base, locale: "en", title: "Course Completion", recipientName: "Yusuf", courseTitle: "Arabic Alphabet for Beginners" },
  ar: { ...base, locale: "ar", title: "إتمام دورة", recipientName: "يوسف", courseTitle: "الحروف العربية للمبتدئين" },
  tr: { ...base, locale: "tr", title: "Kurs Tamamlama", recipientName: "Işıl Çağlar", courseTitle: "Yeni Başlayanlar İçin Arapça Alfabe" },
};

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  for (const [loc, data] of Object.entries(samples)) {
    const buf = await renderCertificatePdf(data);
    const file = path.join(outDir, loc === "en" ? "certificate-sample.pdf" : `certificate-sample-${loc}.pdf`);
    await fs.writeFile(file, buf);
    console.log(`wrote ${file} (${buf.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
