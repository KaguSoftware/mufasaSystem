import type { MetadataRoute } from "next";
import { locales } from "@mufasa/config/locales";
import { siteOrigin } from "@/components/site/seo";
import { listPublishedCourses, listPublishedPrograms } from "@/server/dal/catalog";
import { safePublic } from "@/server/dal/public";

export const revalidate = 3600;

const STATIC_PATHS = [
  "",
  "/programs",
  "/pricing",
  "/tutors",
  "/faq",
  "/contact",
  "/legal/privacy",
  "/legal/terms",
  "/legal/kvkk",
  "/legal/cookies",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [programs, courses] = await Promise.all([
    safePublic(listPublishedPrograms, []),
    safePublic(() => listPublishedCourses(), []),
  ]);
  const paths = [
    ...STATIC_PATHS,
    ...programs.map((p) => `/programs/${p.slug}`),
    ...courses.map((c) => `/courses/${c.slug}`),
  ];
  const origin = siteOrigin();
  return paths.flatMap((path) =>
    locales.map((locale) => ({
      url: `${origin}/${locale}${path}`,
      changeFrequency: path === "" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : path.startsWith("/legal") ? 0.3 : 0.7,
      alternates: {
        languages: Object.fromEntries(locales.map((l) => [l, `${origin}/${l}${path}`])),
      },
    })),
  );
}
