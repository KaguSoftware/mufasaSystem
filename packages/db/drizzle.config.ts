import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: "../../.env" });

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  // Migrations must use the DIRECT (non-pooled, port 5432) Supabase connection.
  dbCredentials: { url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgres://placeholder" },
  casing: "snake_case",
  strict: true,
});
