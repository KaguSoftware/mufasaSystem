-- Defense in depth. The app talks to Postgres only from the server (Drizzle,
-- using the `postgres` role which bypasses RLS). Enabling RLS with NO policies
-- means the public anon/authenticated keys (PostgREST) can read nothing.
-- Run once after migrations:  psql "$DIRECT_DATABASE_URL" -f packages/db/sql/rls.sql
-- Safe to re-run (also run after future migrations that add tables).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', r.tablename);
  END LOOP;
END $$;
