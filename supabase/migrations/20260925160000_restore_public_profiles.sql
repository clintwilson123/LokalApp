-- =============================================
-- CJLINK: RESTORE public.* ACCESS + REFRESH PostgREST SCHEMA CACHE
-- Run this in Supabase SQL Editor.
--
-- SYMPTOM
--   API returns 404 PGRST205:
--     "Could not find the table 'public.profiles' in the schema cache"
--   Signup fails on the profiles INSERT; Admin login silently falls back
--   to role "applicant" so the Admin Dashboard is unreachable.
--
-- INVESTIGATION (live, read-only)
--   GET /rest/v1/profiles        -> PGRST205
--   GET /rest/v1/jobs            -> PGRST205
--   GET /rest/v1/notifications   -> PGRST205
--   GET /rest/v1/applications    -> PGRST205
--   GET /rest/v1/activities      -> PGRST205
--   GET /rest/v1/ (OpenAPI)      -> 0 paths
--   => NOT profiles-specific and NOT an RLS problem (RLS cannot produce
--      PGRST205). PostgREST currently exposes no relations from the
--      `public` schema. Candidates: (a) stale/empty schema cache,
--      (b) `public` missing from Data API exposed schemas,
--      (c) tables genuinely absent.
--
-- SAFETY
--   100% idempotent and non-destructive:
--     * never DROPs a table, never deletes any auth.users row
--     * CREATE TABLE IF NOT EXISTS only creates when genuinely missing
--     * re-applies the project's own policies/functions/trigger verbatim
--     * preserves every security fix (profiles_security_guard, RLS,
--       applicant default role, OTP lockdown)
--     * ends with NOTIFY pgrst, 'reload schema' (cache refresh, no DDL)
--   Every diagnostic below is null-safe, so the script runs even when
--   the table is absent.
-- =============================================


-- =============================================
-- 0. DIAGNOSTICS (informational; safe when table is missing)
-- =============================================

SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'profiles';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

SELECT c.relname,
       c.relrowsecurity AS rls_enabled,
       c.relreplident
FROM pg_class c
WHERE c.oid = to_regclass('public.profiles');

SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY grantee, privilege_type;

SELECT t.tgname
FROM pg_trigger t
WHERE t.tgrelid = to_regclass('public.profiles') AND NOT t.tgisinternal;


-- =============================================
-- 1. TABLE (project definition, verbatim from supabase/setup.sql)
--    Only creates when missing — never drops or replaces.
-- =============================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT CHECK (role IN ('admin', 'applicant')) DEFAULT 'applicant',
  status TEXT DEFAULT 'pending',
  phone_number TEXT,
  location TEXT,
  skills TEXT,
  resume_url TEXT,
  bio TEXT,
  avatar_url TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  consent_accepted BOOLEAN DEFAULT FALSE,
  consent_accepted_at TIMESTAMPTZ,
  signup_risk_level TEXT DEFAULT 'low',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Columns added by later migrations (no-op when the table was built from
-- the definition above; required when an older table definition is present)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_accepted_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_risk_level TEXT DEFAULT 'low';

CREATE INDEX IF NOT EXISTS idx_profiles_signup_risk ON public.profiles (signup_risk_level);


-- =============================================
-- 2. FUNCTIONS THE LOGIN FLOW AND POLICIES DEPEND ON
--    (verbatim from supabase/setup.sql; created BEFORE the policies,
--     because policies reference is_admin())
-- =============================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS JSONB
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(p) FROM profiles p WHERE p.id = auth.uid();
$$;


-- =============================================
-- 3. ROW LEVEL SECURITY (enabled + the project's own policies verbatim)
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert during signup" ON public.profiles;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (is_admin());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (is_admin());

CREATE POLICY "Allow insert during signup"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);


-- =============================================
-- 4. PRIVILEGE-ESCALATION GUARD (security fix — preserved verbatim)
-- =============================================

CREATE OR REPLACE FUNCTION public.profiles_security_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin BOOLEAN := FALSE;
  auth_confirmed TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) INTO caller_is_admin;

  IF TG_OP = 'INSERT' THEN
    IF NOT caller_is_admin THEN
      NEW.role := 'applicant';

      IF NEW.email_verified THEN
        SELECT email_confirmed_at INTO auth_confirmed
        FROM auth.users WHERE id = NEW.id;
        IF auth_confirmed IS NULL THEN
          NEW.email_verified := FALSE;
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NOT caller_is_admin THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Changing the profile role is not allowed';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Changing the profile status is not allowed';
    END IF;

    IF NEW.email_verified IS DISTINCT FROM OLD.email_verified THEN
      SELECT email_confirmed_at INTO auth_confirmed
        FROM auth.users WHERE id = NEW.id;
      IF NEW.email_verified IS NOT TRUE OR auth_confirmed IS NULL THEN
        RAISE EXCEPTION 'Email verification can only be set after the email is confirmed';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_security_guard ON public.profiles;

CREATE TRIGGER profiles_security_guard
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_security_guard();


-- =============================================
-- 5. GRANTS (explicit per table, so the OTP table stays locked down)
-- =============================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated, service_role;

-- Guarded column repair (only when the table is already present)
DO $$
BEGIN
  IF to_regclass('public.jobs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS max_applicants INT DEFAULT 0';
  END IF;
END;
$$;


-- =============================================
-- 5b. TABLES OTHER SCRIPTS MAY HAVE LEFT MISSING
--     All IF NOT EXISTS — never drops, never truncates.
-- =============================================

-- hiring policy (used by ApplyJob.jsx)
CREATE TABLE IF NOT EXISTS public.hiring_policy (
  id SERIAL PRIMARY KEY,
  employer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  policy_text TEXT NOT NULL DEFAULT 'I agree to provide accurate information in my application. I understand that providing false or misleading information may result in disqualification. I consent to CJTECH Computer Trading reviewing my profile, resume, and application details for hiring purposes only.',
  requires_acknowledgment BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hiring_policy_acknowledgments (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_id INT REFERENCES public.hiring_policy(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, policy_id)
);

-- OTP table (used by send-verification-code / verify-otp-code /
-- cleanup-unverified-signup). A bad earlier script may have dropped it.
CREATE TABLE IF NOT EXISTS public.verification_codes (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'signup' CHECK (purpose IN ('signup', 'password_reset')),
  used BOOLEAN DEFAULT FALSE,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_user ON public.verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_code ON public.verification_codes(code);

ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own verification codes" ON public.verification_codes;
DROP POLICY IF EXISTS "System can insert verification codes" ON public.verification_codes;
DROP POLICY IF EXISTS "System can update verification codes" ON public.verification_codes;

-- LOCKDOWN: no client access — only edge functions (service role) may touch codes
REVOKE ALL ON public.verification_codes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_codes TO service_role;


-- =============================================
-- 6. RESTORE THE ADMIN PROFILE ROW
--    Only if the admin auth user exists AND has no profile row.
--    Uses the project's own seed definition (setup.sql / migration 1).
--    Creates no new account and changes no credentials.
-- =============================================

DO $$
DECLARE
  admin_uuid UUID;
BEGIN
  SELECT id INTO admin_uuid FROM auth.users WHERE lower(email) = 'admin@gmail.com';

  IF admin_uuid IS NULL THEN
    RAISE NOTICE 'admin@gmail.com not found in auth.users — skipped profile restore.';
  ELSIF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = admin_uuid) THEN
    INSERT INTO public.profiles (id, full_name, role, status, email_verified)
    VALUES (admin_uuid, 'Admin', 'admin', 'active', true);
    RAISE NOTICE 'Restored missing profile row for admin@gmail.com with role=admin.';
  ELSE
    RAISE NOTICE 'Admin profile row already present — no change.';
  END IF;
END;
$$;


-- =============================================
-- 7. REFRESH THE PostgREST SCHEMA CACHE
--    Non-destructive: tells PostgREST to re-introspect the schema.
-- =============================================

NOTIFY pgrst, 'reload schema';


-- =============================================
-- 8. VERIFY (should show the table, the guard trigger, and the admin row)
-- =============================================

SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'profiles';

SELECT t.tgname
FROM pg_trigger t
WHERE t.tgrelid = to_regclass('public.profiles') AND NOT t.tgisinternal;

SELECT p.id::text, p.full_name, p.role, p.status, p.email_verified, au.email
FROM public.profiles p
JOIN auth.users au ON au.id = p.id
WHERE au.email = 'admin@gmail.com';
