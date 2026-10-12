import type { Db } from "../client";
import { seedBilling } from "./billing";
import { seedCatalog, seedPrograms } from "./catalog";
import { seedFlags } from "./flags";
import { seedGamification } from "./gamification";
import { seedSurahs } from "./surahs";
import { seedUsers } from "./users";

export type SeedStep = (db: Db) => Promise<void>;

/**
 * The seed registry. Steps run in this order and must be idempotent (upsert by
 * slug / key, never blindly insert). Another module adds its file here, e.g.
 * `seedQuran` after `seedSurahs`:
 *
 *   const steps: SeedStep[] = [seedFlags, seedUsers, seedSurahs, seedQuran, ...]
 */
export const steps: SeedStep[] = [seedFlags, seedUsers, seedSurahs, seedPrograms, seedCatalog, seedGamification, seedBilling];
