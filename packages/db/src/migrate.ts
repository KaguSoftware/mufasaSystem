import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: "../../.env" });

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set DIRECT_DATABASE_URL (or DATABASE_URL) in .env first. See docs/supabase-setup.md");
  process.exit(1);
}
const sql = postgres(url, { max: 1 });
await migrate(drizzle(sql), { migrationsFolder: "./migrations" });
console.log("Migrations applied.");
await sql.end();
