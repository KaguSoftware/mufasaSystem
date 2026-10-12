import "server-only";
import { getDb, sql } from "@mufasa/db";
import type { Role } from "@mufasa/db";
import { AppError } from "./errors";

export type RateLimitRule = { max: number; windowSec: number };

/**
 * Named limits for app endpoints (Better Auth limits its own routes, see auth.ts).
 * Per-role overrides: admins/tutors get more headroom for AI tooling.
 */
export const RATE_LIMITS = {
  "ai.chat": { default: { max: 30, windowSec: 60 * 10 }, admin: { max: 120, windowSec: 600 } },
  "ai.scenes": { default: { max: 10, windowSec: 60 * 60 }, admin: { max: 60, windowSec: 3600 } },
  "ai.tts": { default: { max: 10, windowSec: 60 * 60 }, admin: { max: 60, windowSec: 3600 } },
  "ai.recitation": { default: { max: 20, windowSec: 60 * 60 * 24 } },
  "upload.recitation": { default: { max: 30, windowSec: 60 * 60 * 24 } },
  "upload.receipt": { default: { max: 10, windowSec: 60 * 60 * 24 } },
  "messages.send": { default: { max: 60, windowSec: 60 * 10 } },
  "family.create": { default: { max: 10, windowSec: 60 * 60 } },
  "data.request": { default: { max: 5, windowSec: 60 * 60 * 24 } },
  "live.token": { default: { max: 30, windowSec: 60 * 10 } },
} satisfies Record<string, { default: RateLimitRule } & Partial<Record<Role, RateLimitRule>>>;

export type RateLimitKey = keyof typeof RATE_LIMITS;

export function ruleFor(key: RateLimitKey, role?: Role): RateLimitRule {
  const entry = RATE_LIMITS[key] as { default: RateLimitRule } & Partial<Record<Role, RateLimitRule>>;
  return (role && entry[role]) || entry.default;
}

/**
 * Sliding-window limiter stored in Postgres (rate_limit_buckets).
 * One atomic statement: drop hits older than the window, append now, return count.
 * Swap for Upstash Redis later if traffic grows; the signature stays the same.
 */
export async function hitRateLimit(
  bucket: string,
  rule: RateLimitRule,
  now = Date.now(),
): Promise<{ allowed: boolean; remaining: number; resetInSec: number }> {
  const windowStart = now - rule.windowSec * 1000;
  const rows = await getDb().execute<{ hits: string[] }>(sql`
    insert into rate_limit_buckets (key, hits, updated_at)
    values (${bucket}, array[${now}::bigint], now())
    on conflict (key) do update set
      hits = array_append(
        array(select h from unnest(rate_limit_buckets.hits) as h where h > ${windowStart}::bigint),
        ${now}::bigint
      ),
      updated_at = now()
    returning hits
  `);
  const hits = (rows[0]?.hits ?? []).map(Number);
  const count = hits.length;
  const oldest = hits[0] ?? now;
  return {
    allowed: count <= rule.max,
    remaining: Math.max(0, rule.max - count),
    resetInSec: Math.ceil((oldest + rule.windowSec * 1000 - now) / 1000),
  };
}

export async function enforceRateLimit(key: RateLimitKey, userId: string, role?: Role): Promise<void> {
  const res = await hitRateLimit(`${key}:${userId}`, ruleFor(key, role));
  if (!res.allowed) throw new AppError("rate_limited", `Retry in ${res.resetInSec}s`);
}
