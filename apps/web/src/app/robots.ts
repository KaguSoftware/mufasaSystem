import type { MetadataRoute } from "next";
import { siteOrigin } from "@/components/site/seo";

/** Panels, API and live rooms are private; everything else is public. */
export default function robots(): MetadataRoute.Robots {
  const panels = ["student", "parent", "tutor", "admin", "dashboard", "onboarding", "live"];
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", ...["en", "ar", "tr"].flatMap((l) => panels.map((p) => `/${l}/${p}`))],
    },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
