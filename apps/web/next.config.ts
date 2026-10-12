import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

// Single .env at the repo root, shared by web, db scripts and the render worker.
loadEnvConfig(path.resolve(import.meta.dirname, "../.."));

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["@mufasa/config", "@mufasa/db", "@mufasa/video"],
  typedRoutes: false,
  // Next 16 writes an AGENTS.md on `next dev`; our guidance lives in /CLAUDE.md instead.
  agentRules: false,
  experimental: {
    serverActions: { bodySizeLimit: "25mb" }, // recitation audio + receipts
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default withNextIntl(nextConfig);
