import "server-only";
import { z } from "zod";

/**
 * Server env, validated lazily. Nothing here is required for `next build`:
 * every integration checks `isConfigured(...)` and degrades gracefully, so the
 * app runs before Supabase / Gemini / iyzico / LiveKit accounts exist.
 * Full list with comments: /.env.example
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().optional(),

  BETTER_AUTH_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_CHAT_MODEL: z.string().default("gemini-2.5-pro"),
  GEMINI_FAST_MODEL: z.string().default("gemini-2.5-flash"),
  GEMINI_TTS_MODEL: z.string().default("gemini-2.5-flash-preview-tts"),

  IYZICO_API_KEY: z.string().optional(),
  IYZICO_SECRET_KEY: z.string().optional(),
  IYZICO_BASE_URL: z.string().default("https://sandbox-api.iyzipay.com"),

  LIVEKIT_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Academy <no-reply@example.com>"),

  SENTRY_DSN: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  WORKER_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;
export function env(): Env {
  // Empty strings in .env should count as "not set".
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
  cached ??= schema.parse(raw);
  return cached;
}

const groups = {
  db: ["DATABASE_URL"],
  auth: ["DATABASE_URL", "BETTER_AUTH_SECRET"],
  google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  storage: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  gemini: ["GEMINI_API_KEY"],
  iyzico: ["IYZICO_API_KEY", "IYZICO_SECRET_KEY"],
  livekit: ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"],
  email: ["RESEND_API_KEY"],
  sentry: ["SENTRY_DSN"],
} as const satisfies Record<string, readonly (keyof Env)[]>;

export type Integration = keyof typeof groups;

export function isConfigured(integration: Integration): boolean {
  const e = env();
  return groups[integration].every((k) => Boolean(e[k]));
}
