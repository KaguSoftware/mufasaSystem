import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { createRequire } from "node:module";

// Single .env at the repo root, shared by web, db scripts and the render worker.
loadEnvConfig(path.resolve(import.meta.dirname, "../.."));

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["@mufasa/config", "@mufasa/db", "@mufasa/video"],
  // Node-only SDKs with dynamic requires; load them at runtime instead of bundling.
  serverExternalPackages: ["iyzipay", "@react-pdf/renderer"],
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

const intlConfig = withNextIntl(nextConfig);

// Loaded lazily so a build without a DSN never touches the Sentry build plugin.
function loadSentry(): typeof import("@sentry/nextjs/config").withSentryConfig {
  return createRequire(import.meta.url)("@sentry/nextjs/config").withSentryConfig;
}

const hasSentryDsn = Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);

// Sentry wraps the build only when a DSN exists. Source map upload needs SENTRY_AUTH_TOKEN
// and is disabled without it, so builds never require Sentry credentials.
export default hasSentryDsn
  ? loadSentry()(intlConfig, {
      silent: true,
      telemetry: false,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
    })
  : intlConfig;
