import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

export class DbNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set. See docs/supabase-setup.md.");
    this.name = "DbNotConfiguredError";
  }
}

export const isDbConfigured = () => Boolean(process.env.DATABASE_URL);

const globalForDb = globalThis as unknown as { __mufasaDb?: Db; __mufasaSql?: postgres.Sql };

/**
 * Lazily creates the Drizzle client. Throws DbNotConfiguredError when no
 * DATABASE_URL is present so the app can still build and render public pages.
 * Uses the Supabase transaction pooler (port 6543) => prepared statements off.
 */
export function getDb(): Db {
  if (globalForDb.__mufasaDb) return globalForDb.__mufasaDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new DbNotConfiguredError();
  const sql = postgres(url, { prepare: false, max: Number(process.env.DATABASE_POOL_MAX ?? 10) });
  const db = drizzle(sql, { schema, casing: "snake_case" });
  globalForDb.__mufasaSql = sql;
  globalForDb.__mufasaDb = db;
  return db;
}

export { schema };
