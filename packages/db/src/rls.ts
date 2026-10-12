import { readFileSync } from "node:fs";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: "../../.env" });

/** Applies sql/rls.sql (enable RLS + revoke anon/authenticated on every public table). Safe to re-run. */
const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set DIRECT_DATABASE_URL (or DATABASE_URL) in .env first. See docs/supabase-setup.md");
  process.exit(1);
}
const sql = postgres(url, { max: 1 });
await sql.unsafe(readFileSync(new URL("../sql/rls.sql", import.meta.url), "utf8"));
console.log("RLS enabled on all public tables; anon/authenticated revoked.");
await sql.end();
