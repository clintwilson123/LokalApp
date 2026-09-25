-- ============================================================
-- CJLINK — FIX: public.get_profiles_with_email()
--
-- Reported error (Admin -> Manage Users):
--   "get_profiles_with_email() could not be called:
--    structure of query does not match function result type"
--
-- WHAT THIS SCRIPT DOES
--   A. INSPECT  - read-only queries showing the REAL column types in
--                 the live schema, the function's current declared
--                 return type, and proof that the exact expressions
--                 the function selects actually type-check. The
--                 mismatch is therefore observed, not guessed.
--   B. REBUILD  - drops and recreates ONE function with an explicit
--                 cast on every selected expression, so the query's
--                 row type is identical to the declared return type
--                 BY CONSTRUCTION. Works whatever the live types turn
--                 out to be (varchar/text, enum/text,
--                 timestamp/timestamptz, ...).
--   C. VERIFY   - pg_catalog checks (function exists, return type,
--                 PUBLIC/anon/authenticated EXECUTE) plus one
--                 exception-safe guard test.
--
-- TRANSACTION NOTE (important)
--   Supabase SQL Editor sends the whole paste as ONE transaction, so
--   a failing statement would roll back everything above it. That is
--   why every data-touching statement sits in SECTION A, BEFORE the
--   rebuild: if the schema really is wrong, the script stops with
--   NOTHING changed and tells you why. After Section B only pg_catalog
--   reads and one exception-safe DO block run, none of which can abort
--   the fix.
--
-- WHY YOUR PREVIOUS RUN CHANGED NOTHING
--   The earlier version queried a non-existent relation: a per-function
--   grant view under information_schema. PostgreSQL ships only
--   routine_privileges there, not one per function.
--   The error fired at the end of the script, which rolled back the
--   whole transaction, so the DROP/CREATE in Section B was undone.
--   Expect A2 below to show the ORIGINAL signature; C1 shows the new
--   one after Section B. Nothing needs cleaning up - this file is
--   safe to run again as-is.
--
-- WHY DROP + CREATE INSTEAD OF CREATE OR REPLACE:
--   PostgreSQL cannot change an existing function's return type via
--   CREATE OR REPLACE ("cannot change return type of existing
--   function"). This fix also trims the result to only the fields
--   Users.jsx actually renders, which is itself a return-type change,
--   so DROP FUNCTION IF EXISTS + CREATE FUNCTION is required.
--   The DROP is scoped to this one function, uses RESTRICT (never
--   CASCADE), and runs in the same transaction as the CREATE:
--   atomic, nothing else is touched.
--
-- SECURITY (unchanged, plus tightened)
--   SECURITY DEFINER retained. is_admin() gate retained. EXECUTE
--   revoked from PUBLIC and anon, granted to authenticated only.
--   Returns display fields only: no passwords, no auth internals,
--   and no phone_number / location / created_at because Users.jsx
--   never renders them (minimum PII exposure).
--
-- NOTHING HERE DROPS A TABLE, DELETES A ROW, OR DELETES A USER.
-- SAFE TO RE-RUN. Paste the whole file and run it once.
-- ============================================================


-- ============================================================
-- SECTION A — INSPECT (read-only; runs before any change)
-- ============================================================

-- A1. Real types of every column the function reads.
--     Expected: profiles -> uuid / text / text / text / text / text / timestamptz
--               auth.users -> uuid / character varying
--     Anything else here is one half of the mismatch.
SELECT 'public.profiles.' || c.column_name AS "column",
       c.data_type                         AS "data_type",
       c.character_maximum_length          AS "max_len",
       c.datetime_precision                AS "precision",
       c.ordinal_position                  AS "pos"
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name   = 'profiles'
  AND c.column_name IN ('id','full_name','role','status','skills','resume_url','created_at')
UNION ALL
SELECT 'auth.users.' || c.column_name,
       c.data_type,
       c.character_maximum_length,
       c.datetime_precision,
       c.ordinal_position
FROM information_schema.columns c
WHERE c.table_schema = 'auth'
  AND c.table_name   = 'users'
  AND c.column_name IN ('id','email')
ORDER BY 1;

-- A2. The function's CURRENT declared return type, as the database
--     holds it right now — the other half of the mismatch.
--     After your failed previous run this still shows the ORIGINAL
--     signature, because that transaction rolled back completely.
SELECT n.nspname                        AS schema,
       p.proname                        AS function_name,
       l.lanname                        AS language,
       p.prosecdef                      AS security_definer,
       pg_get_function_result(p.oid)    AS declared_result,
       pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language   l ON l.oid = p.prolang
WHERE n.nspname = 'public'
  AND p.proname = 'get_profiles_with_email';

-- A3. Guard prerequisite: is_admin() must exist. It returns FALSE in
--     the SQL Editor (no JWT there) — that is expected and correct.
SELECT public.is_admin() AS am_i_admin_in_this_session;

-- A4. TYPE PROOF — run the exact expressions Section B will install
--     and report their resolved types. Compare against A1: these MUST
--     be uuid / text / text / text / text / text / text.
--     If THIS query errors, the script stops here with nothing changed
--     and the error names the offending column — that is the real
--     schema problem, and it must be fixed before the rebuild.
--     Returns no rows only if the join is empty (see A5); harmless.
SELECT pg_typeof(s.id)         AS t_id,
       pg_typeof(s.full_name)  AS t_full_name,
       pg_typeof(s.email)      AS t_email,
       pg_typeof(s.role)       AS t_role,
       pg_typeof(s.status)     AS t_status,
       pg_typeof(s.skills)     AS t_skills,
       pg_typeof(s.resume_url) AS t_resume_url
FROM (
  SELECT p.id::uuid         AS id,
         p.full_name::text  AS full_name,
         u.email::text      AS email,
         p.role::text       AS role,
         p.status::text     AS status,
         p.skills::text     AS skills,
         p.resume_url::text AS resume_url
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC
  LIMIT 1
) s;

-- A5. Row count for that same join (confirms there is data at all).
SELECT count(*) AS profiles_joined
FROM public.profiles p
JOIN auth.users u ON u.id = p.id;


-- ============================================================
-- SECTION B — REBUILD the function
-- ============================================================

DROP FUNCTION IF EXISTS public.get_profiles_with_email();

CREATE FUNCTION public.get_profiles_with_email()
RETURNS TABLE (
  id         uuid,
  full_name  text,
  email      text,
  role       text,
  status     text,
  skills     text,
  resume_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- SECURITY: only admins may read the email list.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Every expression is explicitly cast to the declared type, so the
  -- row produced here can never disagree with RETURNS TABLE above.
  RETURN QUERY
  SELECT
    p.id::uuid,
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
$fn$;

REVOKE ALL ON FUNCTION public.get_profiles_with_email() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_profiles_with_email() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_with_email() TO authenticated;

COMMENT ON FUNCTION public.get_profiles_with_email() IS
  'Admin only: profile display fields joined with the real auth.users email. SECURITY DEFINER, gated by is_admin(), execute granted to authenticated only.';


-- ============================================================
-- Refresh the PostgREST schema cache so the new return type is used
-- ============================================================

NOTIFY pgrst, 'reload schema';


-- ============================================================
-- SECTION C — VERIFY
--
-- Uses ONLY relations/builtins PostgreSQL is guaranteed to provide:
-- pg_proc, pg_namespace, pg_get_function_result(),
-- has_function_privilege(). Deliberately NO information_schema
-- privilege view: routine_privileges is the only one that exists, and
-- no per-function grant view is used here at all. Querying a
-- non-existent such relation is what broke the previous run.
--
-- C1 and C2 are plain catalog reads and C3 is one exception-safe DO
-- block: none of them can abort or roll back Section B.
-- ============================================================

-- C1. ONE ROW, ALL REQUIRED RESULTS:
--     function_exists / return_type / return_type_ok /
--     security_definer / public_execute / anon_execute /
--     authenticated_execute / acl_raw
--
--     The function is fetched with LIMIT 1 so at most one row exists,
--     then LEFT JOINed onto a constant so exactly one result row is
--     returned even if the function were missing.
WITH fn AS (
  SELECT p.oid,
         p.proacl,
         p.proargnames,
         p.prosecdef,
         pg_get_function_result(p.oid) AS result
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname  = 'get_profiles_with_email'
   LIMIT 1
)
SELECT
  (fn.oid IS NOT NULL) AS function_exists,

  fn.result AS return_type,

  -- Substring checks rather than one exact string match, so this is
  -- independent of how PostgreSQL punctuates TABLE(...). It also
  -- proves the trimmed columns are really gone.
  CASE WHEN fn.result IS NULL THEN NULL
       ELSE fn.result LIKE '%id uuid%'
        AND fn.result LIKE '%full_name text%'
        AND fn.result LIKE '%email text%'
        AND fn.result LIKE '%role text%'
        AND fn.result LIKE '%status text%'
        AND fn.result LIKE '%skills text%'
        AND fn.result LIKE '%resume_url text%'
        AND fn.result NOT LIKE '%phone_number%'
        AND fn.result NOT LIKE '%location%'
        AND fn.result NOT LIKE '%created_at%'
  END AS return_type_ok,

  fn.proargnames AS param_names,

  fn.prosecdef AS security_definer,

  -- PUBLIC: proacl IS NULL means PostgreSQL's built-in default ACL,
  -- under which PUBLIC always has EXECUTE. Otherwise anon is the
  -- reliable probe - Section B revoked anon explicitly, so anon holds
  -- no ACL entry of its own and inherits exactly the PUBLIC grant.
  CASE WHEN fn.oid IS NULL THEN NULL
       ELSE fn.proacl IS NULL OR has_function_privilege('anon', fn.oid, 'EXECUTE')
  END AS public_execute,

  CASE WHEN fn.oid IS NULL THEN NULL
       ELSE has_function_privilege('anon', fn.oid, 'EXECUTE')
  END AS anon_execute,

  CASE WHEN fn.oid IS NULL THEN NULL
       ELSE has_function_privilege('authenticated', fn.oid, 'EXECUTE')
  END AS authenticated_execute,

  -- Raw ACL, for eyeballing: must list authenticated (and owner) but
  -- must NOT contain a bare "=X/" PUBLIC entry.
  fn.proacl::text AS acl_raw

FROM (SELECT 1) AS one_row
LEFT JOIN fn ON true;
-- REQUIRED: function_exists = true,  return_type_ok = true,
--           security_definer = true, public_execute = false,
--           anon_execute = false,    authenticated_execute = true

-- C2. The same privilege checks for BOTH RPCs CJLink relies on.
--     Expected for each row: security_definer = true,
--     anon_execute = false, authenticated_execute = true.
SELECT p.proname,
       p.prosecdef                                              AS security_definer,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('get_profiles_with_email', 'job_filled_counts')
ORDER BY p.proname;

-- C3. Guard test, wrapped so it CANNOT abort or roll back the fix.
--     It prints exactly one of three NOTICE lines — read the text:
--       RESULT=B (GOOD) : non-admin caller was refused -> guard works
--       RESULT=A (BAD)  : call succeeded -> fix did not apply
--       RESULT=C (BAD)  : some other error -> report it
--     Note: the guard fires BEFORE the query runs, so RESULT=B alone
--     does not prove the row types — A4 already proved that.
DO $$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN SELECT * FROM public.get_profiles_with_email() LOOP
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'RESULT=A (BAD): the admin guard did NOT fire - % email rows were returned.', n;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'Access denied%' THEN
      RAISE NOTICE 'RESULT=B (GOOD): non-admin caller refused - %', SQLERRM;
    ELSE
      RAISE NOTICE 'RESULT=C (BAD): unexpected error - %', SQLERRM;
    END IF;
END;
$$;

-- C4. FINAL CHECK (manual, in the app):
--     1. Sign in as admin@gmail.com -> Admin -> Manage Users.
--        The Email column must show real addresses instead of "-",
--        and there must be NO banner mentioning get_profiles_with_email().
--     2. Sign in as a non-admin: Manage Users must not be reachable,
--        and calling the RPC must return "Access denied".
--     This is the authoritative test of the row types, because only a
--     real admin caller gets past the guard and runs RETURN QUERY.

-- ============================================================
-- END
-- ============================================================
