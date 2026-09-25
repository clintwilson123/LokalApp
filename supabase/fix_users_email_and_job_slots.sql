-- ============================================================
-- CJLINK — two minimal, additive fixes
--
-- FIX 1: ensure get_profiles_with_email() exists (Manage Users emails)
-- FIX 2: add job_filled_counts() — ONE source of truth for slot counts
--
-- Non-destructive: no DROP TABLE, no DELETE, no TRUNCATE, no column
-- changes, no changes to any existing RLS policy.
-- Safe to re-run (CREATE OR REPLACE / idempotent grants).
-- ============================================================


-- ============================================================
-- FIX 1 — Admin email RPC (Manage Users)
-- Returns ONLY display fields. No passwords, no auth internals.
-- Authorisation: is_admin() inside the function, so anon/applicants
-- get "Access denied" and can never read the email list.
-- ============================================================

-- NOTE: DROP + CREATE (not CREATE OR REPLACE) — PostgreSQL cannot change
-- an existing function's return type with CREATE OR REPLACE. Explicit
-- casts on every expression make the query's row type equal the declared
-- type, fixing "structure of query does not match function result type".
DROP FUNCTION IF EXISTS public.get_profiles_with_email();
CREATE FUNCTION public.get_profiles_with_email()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  role TEXT,
  status TEXT,
  skills TEXT,
  resume_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY: only admins may read emails
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT p.id::uuid,
         p.full_name::text,
         u.email::text,
         p.role::text,
         p.status::text,
         p.skills::text,
         p.resume_url::text
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_profiles_with_email() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_profiles_with_email() FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_profiles_with_email() TO authenticated;


-- ============================================================
-- FIX 2 — Slot-count RPC (Browse Jobs / Apply Job / Manage Jobs)
--
-- WHY: RLS restricts an applicant to their OWN rows in `applications`,
-- so any client-side COUNT only sees their own application and the
-- slot math becomes wrong. Admins see every row (is_admin policy) and
-- therefore get a different number for the same job.
--
-- WHAT IT RETURNS: job_id + an aggregate count. Nothing else.
-- It never exposes user_id, applicant names, statuses or any single
-- application row — minimum information needed for slot display.
--
-- RULE (preserves existing CJLink behaviour): every status counts
-- except 'rejected'. So pending / reviewed / interview_scheduled /
-- accepted / hired all consume a slot; rejected does not.
-- ============================================================

CREATE OR REPLACE FUNCTION public.job_filled_counts()
RETURNS TABLE (job_id INTEGER, filled_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.job_id, count(*)::bigint
  FROM public.applications a
  WHERE a.status <> 'rejected'
  GROUP BY a.job_id;
$$;

REVOKE EXECUTE ON FUNCTION public.job_filled_counts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.job_filled_counts() FROM anon;
GRANT  EXECUTE ON FUNCTION public.job_filled_counts() TO authenticated;


-- ============================================================
-- Refresh PostgREST schema cache so both new/updated RPCs are exposed
-- ============================================================

NOTIFY pgrst, 'reload schema';


-- ============================================================
-- VERIFY
-- ============================================================

-- V1. both functions must exist and be executable by authenticated
SELECT p.proname,
       p.prosecdef AS security_definer,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS executable_by_authenticated,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS executable_by_anon
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('get_profiles_with_email', 'job_filled_counts')
ORDER BY p.proname;
-- expected: both rows, executable_by_authenticated = true, executable_by_anon = false

-- V2. no existing RLS policy on applications was altered
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'applications'
ORDER BY policyname;

-- V3. the slot rule: rejected excluded, everything else counted
SELECT status, count(*) AS rows,
       (status <> 'rejected') AS consumes_a_slot
FROM public.applications
GROUP BY status
ORDER BY status;

-- V4. per-job filled counts (source of truth now shared by all pages)
SELECT j.id, j.title, j.max_applicants,
       COALESCE(c.filled_count, 0) AS filled_count,
       CASE WHEN j.max_applicants > 0
            THEN GREATEST(0, j.max_applicants - COALESCE(c.filled_count, 0))
            ELSE NULL END AS available_slots
FROM public.jobs j
LEFT JOIN public.job_filled_counts() c ON c.job_id = j.id
ORDER BY j.id;

-- V5. sanity: max_applicants column must exist (0 = unlimited / badge hidden)
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'max_applicants';
