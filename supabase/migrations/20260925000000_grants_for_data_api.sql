-- =============================================
-- GRANTS FOR DATA API ACCESS
-- Supabase stops auto-granting new public-schema tables
-- to the Data API roles on 30 Oct 2026. This backfills
-- existing tables and re-establishes default privileges
-- so tables created by future migrations are reachable
-- through PostgREST/supabase-js automatically.
-- Idempotent — safe to re-run.
-- =============================================

-- Schema usage for the Data API roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Backfill tables that already exist
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;

-- Backfill sequences (required for SERIAL/IDENTITY id inserts)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Cover tables/sequences created by future migrations
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
