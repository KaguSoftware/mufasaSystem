/**
 * Certificate PDF layout (landscape A4) rendered with @react-pdf/renderer.
 * Pure: takes plain data, returns a Buffer. No DB or storage access, so it can
 * be run offline by `pnpm --filter render-worker certificate:sample`.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { brand } from "@mufasa/config/brand";

const here = path.dirname(fileURLToPath(import.meta.url));
const fontDir = path.resolve(here, "../../assets/fonts");

Font.register({
  family: "NotoSerif",
  fonts: [
    { src: path.join(fontDir, "NotoSerif-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontDir, "NotoSerif-Bold.ttf"), fontWeight: 700 },
  ],
});
// Variable Noto Naskh Arabic (OFL). The same file serves both weights.
Font.register({
  family: "NotoNaskh",
  fonts: [
    // Static Amiri: react-pdf mis-positions marks with variable fonts (e.g. NotoNaskhArabic VF).
    { src: path.join(fontDir, "Amiri-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontDir, "Amiri-Bold.ttf"), fontWeight: 700 },
  ],
});
// No hyphenation: it breaks names and URLs.
Font.registerHyphenationCallback((word) => [word]);

export type CertificateLocale = "en" | "ar" | "tr";

export type CertificateData = {
  locale: CertificateLocale;
  /** Certificate title, already resolved for the locale. */
  title: string;
  recipientName: string;
  /** Course title, already resolved for the locale (optional for manual certificates). */
  courseTitle?: string | null;
  issuedAt: Date;
  code: string;
  verifyUrl: string;
};

const LABELS: Record<CertificateLocale, { heading: string; presented: string; completed: string; issued: string; code: string; verify: string }> = {
  en: {
    heading: "Certificate",
    presented: "This certificate is proudly presented to",
    completed: "for successfully completing",
    issued: "Issued on",
    code: "Verification code",
    verify: "Verify this certificate at",
  },
  ar: {
    heading: "شهادة",
    presented: "تُمنح هذه الشهادة بكل فخر إلى",
    completed: "تقديرًا لإتمام",
    issued: "تاريخ الإصدار",
    code: "رمز التحقق",
    verify: "للتحقق من صحة هذه الشهادة زوروا",
  },
  tr: {
    heading: "Sertifika",
    presented: "Bu sertifika gururla takdim edilir",
    completed: "başarıyla tamamladığı için",
    issued: "Düzenlenme tarihi",
    code: "Doğrulama kodu",
    verify: "Bu sertifikayı doğrulamak için",
  },
};

// Arabic-Indic digits ("ar-EG") keep the date as one RTL run; Latin digits get reordered by bidi.
const INTL_LOCALE: Record<CertificateLocale, string> = { en: "en-GB", ar: "ar-EG", tr: "tr-TR" };

const GOLD = "#a8801f";
const INK = "#1f2937";
const MUTED = "#6b7280";

const styles = StyleSheet.create({
  page: { padding: 28, backgroundColor: "#fffdf7" },
  outer: { flexGrow: 1, borderWidth: 3, borderColor: GOLD, padding: 6 },
  inner: { flexGrow: 1, borderWidth: 1, borderColor: GOLD, paddingVertical: 26, paddingHorizontal: 48, alignItems: "center" },
  academy: { fontSize: 15, letterSpacing: 3, color: GOLD, fontWeight: 700 },
  heading: { marginTop: 10, fontSize: 40, color: INK, fontWeight: 700 },
  line: { marginTop: 12, width: 120, borderTopWidth: 1.5, borderTopColor: GOLD },
  presented: { marginTop: 18, fontSize: 13, color: MUTED },
  name: { marginTop: 10, fontSize: 34, color: INK, fontWeight: 700 },
  completed: { marginTop: 14, fontSize: 13, color: MUTED },
  title: { marginTop: 8, fontSize: 22, color: INK, fontWeight: 700, textAlign: "center" },
  course: { marginTop: 6, fontSize: 16, color: INK, textAlign: "center" },
  footer: { marginTop: "auto", width: "100%", justifyContent: "space-between", alignItems: "flex-end" },
  footerCol: { width: "46%" },
  small: { fontSize: 10, color: MUTED },
  value: { marginTop: 2, fontSize: 12, color: INK },
  mono: { marginTop: 2, fontSize: 14, color: INK, fontWeight: 700, letterSpacing: 1 },
  url: { marginTop: 2, fontSize: 10, color: INK },
});

export function CertificateDocument({ data }: { data: CertificateData }) {
  const rtl = data.locale === "ar";
  const L = LABELS[data.locale];
  const family = rtl ? "NotoNaskh" : "NotoSerif";
  const date = new Intl.DateTimeFormat(INTL_LOCALE[data.locale], { dateStyle: "long", timeZone: "UTC" }).format(data.issuedAt);
  const dateAlign = rtl ? "right" : "left";
  const codeAlign = rtl ? "left" : "right";
  const centered = { fontFamily: family, textAlign: "center" as const };

  return (
    <Document title={`${L.heading} ${data.code}`} author={brand.name} creator={brand.name}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.outer}>
          <View style={styles.inner}>
            <Text style={[styles.academy, { fontFamily: "NotoSerif" }]}>{brand.name.toUpperCase()}</Text>
            <Text style={[styles.heading, centered]}>{L.heading}</Text>
            <View style={styles.line} />
            <Text style={[styles.presented, centered]}>{L.presented}</Text>
            <Text style={[styles.name, centered]}>{data.recipientName}</Text>
            <Text style={[styles.completed, centered]}>{L.completed}</Text>
            <Text style={[styles.title, centered]}>{data.title}</Text>
            {data.courseTitle && data.courseTitle !== data.title ? (
              <Text style={[styles.course, centered]}>{data.courseTitle}</Text>
            ) : null}

            <View style={[styles.footer, { flexDirection: rtl ? "row-reverse" : "row" }]}>
              <View style={styles.footerCol}>
                <Text style={[styles.small, { fontFamily: family, textAlign: dateAlign }]}>{L.issued}</Text>
                <Text style={[styles.value, { fontFamily: family, textAlign: dateAlign }]}>{date}</Text>
              </View>
              <View style={styles.footerCol}>
                <Text style={[styles.small, { fontFamily: family, textAlign: codeAlign }]}>{L.code}</Text>
                <Text style={[styles.mono, { fontFamily: "NotoSerif", textAlign: codeAlign }]}>{data.code}</Text>
                <Text style={[styles.small, { fontFamily: family, marginTop: 6, textAlign: codeAlign }]}>{L.verify}</Text>
                <Text style={[styles.url, { fontFamily: "NotoSerif", textAlign: codeAlign }]}>{data.verifyUrl}</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderCertificatePdf(data: CertificateData): Promise<Buffer> {
  return renderToBuffer(<CertificateDocument data={data} />);
}
