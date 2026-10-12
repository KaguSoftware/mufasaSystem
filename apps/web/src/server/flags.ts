import "server-only";
import { getDb, isDbConfigured, schema } from "@mufasa/db";
import { AppError } from "./errors";
import type { SessionUser } from "./session";

/**
 * Known feature flags and their defaults (used when the row doesn't exist yet).
 * Admins toggle them at /admin/flags. Add new flags here.
 */
export const FLAG_DEFAULTS = {
  ai_studio: { enabled: true, description: "AI script chat + whiteboard video generation" },
  ai_recitation_feedback: { enabled: true, description: "Gemini feedback on uploaded recitations" },
  live_video: { enabled: true, description: "Built-in LiveKit classrooms (else external links only)" },
  iyzico_checkout: { enabled: false, description: "Online card payments via iyzico" },
  manual_payments: { enabled: true, description: "IBAN / WhatsApp payment with receipt upload" },
  placement_test: { enabled: true, description: "Placement test during onboarding" },
  gamification: { enabled: true, description: "XP, streaks and badges" },
  certificates: { enabled: true, description: "Auto-issued PDF certificates" },
  parent_messaging: { enabled: true, description: "Parent and tutor message threads" },
  weekly_digest: { enabled: true, description: "Weekly progress digest email to parents (TODO: per-user opt-out)" },
} as const;

export type FlagKey = keyof typeof FLAG_DEFAULTS;

type FlagRow = typeof schema.featureFlags.$inferSelect;

let cache: { at: number; rows: Map<string, FlagRow> } | null = null;
const TTL_MS = 30_000;

async function loadFlags(): Promise<Map<string, FlagRow>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  const rows = await getDb().select().from(schema.featureFlags);
  cache = { at: Date.now(), rows: new Map(rows.map((r) => [r.key, r])) };
  return cache.rows;
}

export function invalidateFlagCache() {
  cache = null;
}

/** Stable 0..99 bucket per user+flag, so percentage rollouts don't flicker. */
export function rolloutBucket(userId: string, flag: string): number {
  let h = 2166136261;
  for (const ch of `${flag}:${userId}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 100;
}

/** Pure evaluation, exported for tests. */
export function evaluateFlag(
  row: Pick<FlagRow, "key" | "enabled" | "roles" | "percentage" | "userIds" | "programIds"> | undefined,
  fallback: boolean,
  user?: Pick<SessionUser, "id" | "role"> | null,
  ctx?: { programId?: string },
): boolean {
  if (!row) return fallback;
  if (user && row.userIds.includes(user.id)) return true;
  if (!row.enabled) return false;
  if (row.roles.length && (!user || !row.roles.includes(user.role))) return false;
  if (row.programIds.length && ctx?.programId && !row.programIds.includes(ctx.programId)) return false;
  if (row.percentage < 100) {
    if (!user) return false;
    return rolloutBucket(user.id, row.key) < row.percentage;
  }
  return true;
}

export async function isEnabled(
  key: FlagKey,
  user?: Pick<SessionUser, "id" | "role"> | null,
  ctx?: { programId?: string },
): Promise<boolean> {
  const fallback = FLAG_DEFAULTS[key].enabled;
  if (!isDbConfigured()) return fallback;
  const rows = await loadFlags();
  return evaluateFlag(rows.get(key), fallback, user, ctx);
}

export async function requireFlag(key: FlagKey, user?: Pick<SessionUser, "id" | "role"> | null) {
  if (!(await isEnabled(key, user))) throw new AppError("feature_disabled", key);
}
