import "server-only";
import { z } from "zod";
import { eq, getDb, schema, ROLES } from "@mufasa/db";
import { audit } from "../audit";
import { FLAG_DEFAULTS, invalidateFlagCache, type FlagKey } from "../flags";
import { forbidden, notFound } from "../errors";
import type { SessionUser } from "../session";

export const FLAG_KEYS = Object.keys(FLAG_DEFAULTS) as FlagKey[];

export type FlagView = {
  key: FlagKey;
  description: string;
  enabled: boolean;
  roles: string[];
  percentage: number;
  /** false when no row exists yet (the code default applies). */
  persisted: boolean;
};

export async function listFlags(actor: SessionUser): Promise<FlagView[]> {
  if (actor.role !== "admin") throw forbidden();
  const rows = await getDb().select().from(schema.featureFlags);
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return FLAG_KEYS.map((key) => {
    const row = byKey.get(key);
    const def = FLAG_DEFAULTS[key];
    return {
      key,
      description: row?.description ?? def.description,
      enabled: row ? row.enabled : def.enabled,
      roles: row?.roles ?? [],
      percentage: row?.percentage ?? 100,
      persisted: Boolean(row),
    };
  });
}

export const upsertFlagSchema = z.object({
  key: z.string().refine((k): k is FlagKey => k in FLAG_DEFAULTS),
  enabled: z.boolean(),
  roles: z.array(z.enum(ROLES)).max(4),
  percentage: z.number().int().min(0).max(100),
});
export type UpsertFlagInput = z.infer<typeof upsertFlagSchema>;

export async function upsertFlag(actor: SessionUser, input: UpsertFlagInput): Promise<void> {
  if (actor.role !== "admin") throw forbidden();
  const data = upsertFlagSchema.parse(input);
  const key = data.key as FlagKey;
  if (!(key in FLAG_DEFAULTS)) throw notFound();
  const db = getDb();
  const before = await db.query.featureFlags.findFirst({ where: eq(schema.featureFlags.key, key) });
  const values = { key, description: FLAG_DEFAULTS[key].description, enabled: data.enabled, roles: data.roles, percentage: data.percentage };
  await db
    .insert(schema.featureFlags)
    .values(values)
    .onConflictDoUpdate({
      target: schema.featureFlags.key,
      set: { enabled: data.enabled, roles: data.roles, percentage: data.percentage },
    });
  invalidateFlagCache();
  await audit({
    actorId: actor.id,
    action: "flag.upsert",
    entity: "feature_flags",
    entityId: key,
    before: before ? { enabled: before.enabled, roles: before.roles, percentage: before.percentage } : { enabled: FLAG_DEFAULTS[key].enabled, default: true },
    after: { enabled: data.enabled, roles: data.roles, percentage: data.percentage },
  });
}
