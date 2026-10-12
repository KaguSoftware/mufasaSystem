import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema";
import { steps } from "./steps";

config({ path: "../../.env" });

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set DIRECT_DATABASE_URL (or DATABASE_URL) in .env first. See docs/supabase-setup.md");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });
const db = drizzle(sql, { schema, casing: "snake_case" });

try {
  console.log("Seeding...");
  for (const step of steps) {
    console.log(`> ${step.name}`);
    await step(db);
  }
  console.log("Seed complete.");
} catch (err) {
  console.error("Seed failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
