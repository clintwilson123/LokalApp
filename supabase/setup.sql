-- =============================================
-- CJLINK — FULL REPAIR / CLEAN DATABASE SETUP
-- Run this in Supabase SQL Editor (paste this file only)
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS
--
-- GUARANTEES
--   * NEVER drops a table, NEVER deletes a user or row
--   * never removes the profiles_security_guard trigger
--   * never removes RLS or weakens any policy
--   * verification_codes stays locked (service_role only)
--   * restores the admin profile non-destructively
--   * finishes with NOTIFY pgrst, 'reload schema' to fix PGRST205
--
-- SYMPTOM BEING FIXED
--   404 PGRST205 "Could not find the table 'public.profiles' in the
--   schema cache" — signup fails and Admin login falls back to
--   role "applicant". Every public table 404s and /rest/v1/ lists 0
--   paths, so PostgREST is exposing nothing from `public`.
-- =============================================

-- =============================================
-- 0. DIAGNOSTICS — BEFORE (null-safe, runs even if tables are missing)
-- =============================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

SELECT c.relname, c.relrowsecurity AS rls_enabled
FROM pg_class c
WHERE c.oid = to_regclass('public.profiles');

SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

-- =============================================
-- 1. TABLES
-- =============================================

CREATE TABLE IF NOT EXISTS profiles (
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

CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT DEFAULT 'CJTECH Computer Trading',
  location TEXT DEFAULT 'Sangi, Toledo City',
  salary TEXT,
  description TEXT,
  requirements TEXT[],
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  job_id INT REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  score INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT,
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interviews (
  id SERIAL PRIMARY KEY,
  application_id INT REFERENCES applications(id) ON DELETE CASCADE,
  employer_id UUID REFERENCES profiles(id),
  date DATE,
  time TIME,
  location TEXT,
  instructions TEXT,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT,
  ip TEXT,
  device TEXT,
  location TEXT,
  type TEXT DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hiring_policy (
  id SERIAL PRIMARY KEY,
  employer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  policy_text TEXT NOT NULL DEFAULT 'I agree to provide accurate information in my application. I understand that providing false or misleading information may result in disqualification. I consent to CJTECH Computer Trading reviewing my profile, resume, and application details for hiring purposes only.',
  requires_acknowledgment BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hiring_policy_acknowledgments (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_id INT REFERENCES hiring_policy(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, policy_id)
);

-- =============================================
-- 2. ADD MISSING COLUMNS (safe if exist)
-- =============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consent_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consent_accepted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signup_risk_level TEXT DEFAULT 'low';

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS max_applicants INT DEFAULT 0;

-- =============================================
-- 2b. INDEXES (speed up common queries)
-- =============================================

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_interviews_application_id ON interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_hiring_policy_ack_user ON hiring_policy_acknowledgments(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_signup_risk ON profiles(signup_risk_level);

-- =============================================
-- 3. ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE hiring_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE hiring_policy_acknowledgments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. SECURITY DEFINER FUNCTIONS (bypass RLS)
-- =============================================

-- Check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- Get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Get current user's profile as JSONB
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS JSONB
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(p) FROM profiles p WHERE p.id = auth.uid();
$$;

-- Upsert profile (creates if missing, updates if exists)
-- SECURITY: INSERT defaults role='applicant' to prevent privilege escalation
CREATE OR REPLACE FUNCTION update_my_profile(p_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  INSERT INTO profiles (id, full_name, phone_number, location, skills, bio, resume_url, avatar_url, role, status, consent_accepted, consent_accepted_at)
  VALUES (
    auth.uid(),
    p_data->>'full_name',
    NULLIF(p_data->>'phone_number', ''),
    p_data->>'location',
    p_data->>'skills',
    p_data->>'bio',
    NULLIF(p_data->>'resume_url', ''),
    p_data->>'avatar_url',
    'applicant',
    'active',
    COALESCE((p_data->>'consent_accepted')::boolean, false),
    CASE WHEN p_data ? 'consent_accepted' AND (p_data->>'consent_accepted')::boolean = true THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name    = CASE WHEN p_data ? 'full_name'    THEN p_data->>'full_name'                    ELSE profiles.full_name END,
    phone_number = CASE WHEN p_data ? 'phone_number' THEN NULLIF(p_data->>'phone_number', '')     ELSE profiles.phone_number END,
    location     = CASE WHEN p_data ? 'location'     THEN p_data->>'location'                     ELSE profiles.location END,
    skills       = CASE WHEN p_data ? 'skills'       THEN p_data->>'skills'                       ELSE profiles.skills END,
    bio          = CASE WHEN p_data ? 'bio'          THEN p_data->>'bio'                          ELSE profiles.bio END,
    resume_url   = CASE WHEN p_data ? 'resume_url'   THEN NULLIF(p_data->>'resume_url', '')       ELSE profiles.resume_url END,
    avatar_url   = CASE WHEN p_data ? 'avatar_url'   THEN p_data->>'avatar_url'                   ELSE profiles.avatar_url END,
    consent_accepted = CASE WHEN p_data ? 'consent_accepted' THEN COALESCE((p_data->>'consent_accepted')::boolean, false) ELSE profiles.consent_accepted END,
    consent_accepted_at = CASE WHEN p_data ? 'consent_accepted' AND (p_data->>'consent_accepted')::boolean = true THEN now() ELSE profiles.consent_accepted_at END;

  SELECT to_jsonb(p) INTO result FROM profiles p WHERE p.id = auth.uid();
  RETURN result;
END;
$$;

-- Get all profiles with email (ADMIN ONLY — checks is_admin inside function)
-- NOTE: DROP + CREATE (not CREATE OR REPLACE) because PostgreSQL refuses
-- to change an existing function's return type with CREATE OR REPLACE.
-- Every selected expression is explicitly cast so the query's row type
-- always equals the declared type (fixes "structure of query does not
-- match function result type"). Returns only the fields Users.jsx renders.
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
  -- SECURITY: Only admins can call this function
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

REVOKE ALL ON FUNCTION public.get_profiles_with_email() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_profiles_with_email() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_with_email() TO authenticated;

-- Sync email_verified status from auth.users.email_confirmed_at
CREATE OR REPLACE FUNCTION sync_email_verified()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_confirmed_at TIMESTAMPTZ;
  v_result BOOLEAN;
BEGIN
  SELECT email_confirmed_at INTO v_confirmed_at
  FROM auth.users
  WHERE id = auth.uid();

  v_result := (v_confirmed_at IS NOT NULL);

  UPDATE profiles
  SET email_verified = v_result
  WHERE id = auth.uid();

  RETURN v_result;
END;
$$;

-- =============================================
-- 5. RLS POLICIES
-- =============================================

-- --- PROFILES ---
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Allow insert during signup" ON profiles;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (is_admin());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  USING (is_admin());

CREATE POLICY "Allow insert during signup"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- SECURITY: row-level guard on role/status/email_verified.
-- RLS lets users update their own row; this trigger stops a user from
-- escalating role to admin, changing status, or setting
-- email_verified=true before the email is actually confirmed.
-- No-JWT callers (SQL editor, service role) pass through unchanged.
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

-- --- APPLICATIONS ---
DROP POLICY IF EXISTS "Users can read own applications" ON applications;
DROP POLICY IF EXISTS "Admins can read all applications" ON applications;
DROP POLICY IF EXISTS "Users can insert own applications" ON applications;
DROP POLICY IF EXISTS "Admins can update applications" ON applications;
DROP POLICY IF EXISTS "Users can update own applications" ON applications;
DROP POLICY IF EXISTS "Users can delete own applications" ON applications;

CREATE POLICY "Users can read own applications"
  ON applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all applications"
  ON applications FOR SELECT
  USING (is_admin());

CREATE POLICY "Users can insert own applications"
  ON applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own applications"
  ON applications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update applications"
  ON applications FOR UPDATE
  USING (is_admin());

CREATE POLICY "Users can delete own applications"
  ON applications FOR DELETE
  USING (auth.uid() = user_id);

-- --- NOTIFICATIONS ---
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Name kept identical to the existing policy so DROP+CREATE stays
-- idempotent. Tightened from WITH CHECK (true): a client may only insert
-- a notification addressed to itself (verified: all four client-side
-- inserts target the current user). Edge functions that notify other
-- users use the service_role key and bypass RLS, so they are unaffected.
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- --- INTERVIEWS ---
DROP POLICY IF EXISTS "Users can read own interviews" ON interviews;
DROP POLICY IF EXISTS "Admins can read all interviews" ON interviews;
DROP POLICY IF EXISTS "Admins can manage interviews" ON interviews;
DROP POLICY IF EXISTS "Admins can update interviews" ON interviews;

CREATE POLICY "Users can read own interviews"
  ON interviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM applications
      WHERE applications.id = interviews.application_id
      AND applications.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all interviews"
  ON interviews FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can manage interviews"
  ON interviews FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update interviews"
  ON interviews FOR UPDATE
  USING (is_admin());

-- --- ACTIVITIES ---
DROP POLICY IF EXISTS "Users can read own activities" ON activities;
DROP POLICY IF EXISTS "Admins can read all activities" ON activities;
DROP POLICY IF EXISTS "System can insert activities" ON activities;

CREATE POLICY "Users can read own activities"
  ON activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all activities"
  ON activities FOR SELECT
  USING (is_admin());

-- Name kept identical so DROP+CREATE stays idempotent. Tightened from
-- WITH CHECK (true): clients may only log their own activity. No client
-- code inserts into activities today; service_role writers bypass RLS.
CREATE POLICY "System can insert activities"
  ON activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- --- HIRING POLICY ---
DROP POLICY IF EXISTS "Anyone can read hiring policy" ON hiring_policy;
DROP POLICY IF EXISTS "Admins can manage hiring policy" ON hiring_policy;

CREATE POLICY "Anyone can read hiring policy"
  ON hiring_policy FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage hiring policy"
  ON hiring_policy FOR ALL
  USING (is_admin());

-- --- HIRING POLICY ACKNOWLEDGMENTS ---
DROP POLICY IF EXISTS "Users can read own acknowledgments" ON hiring_policy_acknowledgments;
DROP POLICY IF EXISTS "Users can insert own acknowledgments" ON hiring_policy_acknowledgments;

CREATE POLICY "Users can read own acknowledgments"
  ON hiring_policy_acknowledgments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own acknowledgments"
  ON hiring_policy_acknowledgments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- --- JOBS ---
DROP POLICY IF EXISTS "Anyone can read jobs" ON jobs;
DROP POLICY IF EXISTS "Admins can insert jobs" ON jobs;
DROP POLICY IF EXISTS "Admins can update jobs" ON jobs;
DROP POLICY IF EXISTS "Admins can delete jobs" ON jobs;

CREATE POLICY "Anyone can read jobs"
  ON jobs FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert jobs"
  ON jobs FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update jobs"
  ON jobs FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete jobs"
  ON jobs FOR DELETE
  USING (is_admin());

-- =============================================
-- 6. SEED JOBS (check by title, not by LIMIT)
-- =============================================

INSERT INTO jobs (title, company, location, salary, description, requirements, icon)
SELECT 'Sales Assistant', 'CJTECH Computer Trading', 'Sangi, Toledo City', '₱15,000 — ₱18,000 / month', 'Assist customers with product inquiries, handle transactions, and maintain store cleanliness and organization.', ARRAY['High school graduate', 'Good communication skills', 'Basic math skills', 'Customer service'], '🛍️'
WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE title = 'Sales Assistant');

INSERT INTO jobs (title, company, location, salary, description, requirements, icon)
SELECT 'Computer Service', 'CJTECH Computer Trading', 'Sangi, Toledo City', '₱20,000 — Ᵽ25,000 / month', 'Provide technical support, diagnose hardware/software issues, and perform repairs and maintenance.', ARRAY['IT-related course', 'Hardware troubleshooting', 'Software installation', 'Network basics'], '💻'
WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE title = 'Computer Service');

INSERT INTO jobs (title, company, location, salary, description, requirements, icon)
SELECT 'Repair Technician', 'CJTECH Computer Trading', 'Sangi, Toledo City', '₱18,000 — ₱22,000 / month', 'Diagnose and repair electronic devices, gadgets, and computer components with precision.', ARRAY['Technical vocational course', 'Soldering skills', 'Component-level repair', 'Multimeter usage'], '🔧'
WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE title = 'Repair Technician');

INSERT INTO jobs (title, company, location, salary, description, requirements, icon)
SELECT 'Store Manager', 'CJTECH Computer Trading', 'Sangi, Toledo City', '₱30,000 — ₱35,000 / month', 'Oversee daily store operations, manage staff schedules, ensure sales targets are met, and report to headquarters.', ARRAY['Management experience', 'Leadership skills', 'Inventory management', 'Sales reporting'], '🏪'
WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE title = 'Store Manager');

INSERT INTO jobs (title, company, location, salary, description, requirements, icon)
SELECT 'IT Support Specialist', 'CJTECH Computer Trading', 'Sangi, Toledo City', '₱22,000 — ₱28,000 / month', 'Provide technical support for hardware, software, and network issues. Manage user accounts, maintain IT infrastructure, and ensure smooth operation of all computer systems.', ARRAY[
  'Hardware troubleshooting',
  'Software installation and configuration',
  'Network troubleshooting',
  'Windows and Linux OS support',
  'Active Directory management',
  'Help desk ticketing systems',
  'Remote desktop support',
  'Printer and peripheral support',
  'Backup and recovery',
  'IT security fundamentals',
  'Customer service',
  'End-user support',
  'System administration'
], '💻'
WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE title = 'IT Support Specialist');

-- =============================================
-- 7. ADMIN SETUP
-- =============================================

DO $$
DECLARE
  user_uuid UUID;
BEGIN
  SELECT id INTO user_uuid FROM auth.users WHERE email = 'admin@gmail.com';
  IF user_uuid IS NULL THEN
    RAISE NOTICE 'admin@gmail.com not found in auth.users — skipped admin seeding. Create it in Authentication → Users, then re-run.';
    RETURN;
  END IF;

  -- NON-DESTRUCTIVE / SPEC-COMPLIANT:
  --   * auth user missing  -> create nothing, skip
  --   * profile missing    -> insert the missing admin profile
  --   * profile exists     -> left completely unchanged
  -- Never deletes applications, notifications or profiles.
  -- Never touches credentials or passwords.
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = user_uuid) THEN
    INSERT INTO profiles (id, full_name, role, status, email_verified)
    VALUES (user_uuid, 'Admin', 'admin', 'active', true);
  END IF;

  -- Auth bookkeeping only (no credentials involved).
  -- COALESCE makes it idempotent: email_confirmed_at is stamped only if
  -- still NULL, and the metadata merge yields the same value on re-runs.
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW())
  WHERE id = user_uuid;

  -- Seed default hiring policy for admin
  INSERT INTO hiring_policy (employer_id, policy_text, requires_acknowledgment)
  VALUES (
    user_uuid,
    'I agree to provide accurate and truthful information in my application. I understand that providing false or misleading information may result in disqualification or termination. I consent to CJTECH Computer Trading reviewing my profile, resume, and application details solely for hiring purposes. I understand that my personal information will not be shared with unauthorized parties.',
    TRUE
  )
  ON CONFLICT (employer_id) DO NOTHING;
END $$;

-- =============================================
-- 8. STORAGE BUCKET + POLICIES
-- =============================================

INSERT INTO storage.buckets (id, name, public)
SELECT 'resumes', 'resumes', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'resumes');

-- STORAGE POLICY REVIEW (requirement I)
--   INSERT/UPDATE/DELETE are all scoped to the caller's own folder
--   resumes/{auth.uid()}/... — no user can write into another user's
--   folder. This is the required behaviour.
--
--   SELECT is intentionally public for this bucket. This is dictated by
--   the application: Profile.jsx uploads and then calls getPublicUrl(),
--   and stores that public URL in profiles.resume_url / avatar_url.
--   Admins and other users view resumes through that stored URL, and
--   there is no signed-URL code path in the app. The bucket itself is
--   therefore created with public = true.
--   HARDENING (optional, requires app changes — not done here):
--   switch to a private bucket + createSignedUrl in Profile.jsx.

-- Drop old policies first (each DROP is immediately followed by its
-- exact recreation below, so this remains idempotent)
DROP POLICY IF EXISTS "Users can upload their own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Resumes are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Upload: only to own folder (resumes/{user_id}/...)
CREATE POLICY "Users can upload their own resumes"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'resumes'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = 'resumes'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Read: public (avatars and resumes need to be viewable)
CREATE POLICY "Resumes are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resumes');

-- Update: only own files
CREATE POLICY "Users can update their own files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'resumes'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Delete: only own files
CREATE POLICY "Users can delete their own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'resumes'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- =============================================
-- 9. CLEANUP: remove obsolete phone-based reset functions
--
-- WHY THESE DROPS ARE REQUIRED (security, not tidying):
--   reset_with_code() wrote auth.users.encrypted_password directly —
--   that mechanism is prohibited in the current design. send_reset_code()
--   stored OTPs in profiles.preferences, bypassing verification_codes
--   and its attempt counter. The current design is Supabase Auth email
--   recovery only, so these functions must not remain callable.
--
-- NO COLUMNS ARE DROPPED. Obsolete security_question / security_answer
-- columns, if present, are deliberately left in place and unused.
-- =============================================

DROP FUNCTION IF EXISTS send_reset_code;
DROP FUNCTION IF EXISTS verify_reset_code;
DROP FUNCTION IF EXISTS reset_with_code;
DROP FUNCTION IF EXISTS get_security_question;
DROP FUNCTION IF EXISTS reset_password_by_phone;
DROP FUNCTION IF EXISTS sync_user_phone;

-- =============================================
-- 10. DATA API GRANTS (required for new tables after 30 Oct 2026)
-- =============================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Future tables/sequences created from this project are auto-granted
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

-- =============================================
-- 10b. VERIFICATION CODES LOCKDOWN
-- The section-10 grants above hit every table, so the OTP table is
-- re-tightened here: RLS on, no client policies, no client grants.
-- Only edge functions (service role, bypasses RLS) may touch codes.
-- =============================================

CREATE TABLE IF NOT EXISTS verification_codes (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'signup' CHECK (purpose IN ('signup', 'password_reset')),
  used BOOLEAN DEFAULT FALSE,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Older installs may pre-date the attempt counter
ALTER TABLE verification_codes ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_verification_codes_user ON verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_code ON verification_codes(code);

ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own verification codes" ON verification_codes;
DROP POLICY IF EXISTS "System can insert verification codes" ON verification_codes;
DROP POLICY IF EXISTS "System can update verification codes" ON verification_codes;

REVOKE ALL ON verification_codes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON verification_codes TO service_role;

-- =============================================
-- 10c. REFRESH THE PostgREST SCHEMA CACHE
-- Non-destructive: tells PostgREST to re-introspect `public`.
-- This is the step that clears PGRST205 "not in the schema cache".
-- =============================================

NOTIFY pgrst, 'reload schema';

-- =============================================
-- 11. VERIFY (run these after the script)
-- =============================================

-- 11a. admin profile row (role must be admin)
SELECT p.id::text, p.full_name, p.role, p.status, p.email_verified, au.email
FROM profiles p
JOIN auth.users au ON au.id = p.id
WHERE au.email = 'admin@gmail.com';

-- 11b. every public table should be listed here
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 11c. profiles must have consent_accepted / consent_accepted_at /
--      signup_risk_level (otherwise signup fails on INSERT)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 11d. jobs must have max_applicants (otherwise job creation fails)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'jobs'
ORDER BY ordinal_position;

-- 11e. RLS on + policies present
SELECT relrowsecurity AS rls_enabled
FROM pg_class WHERE oid = to_regclass('public.profiles');

SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

-- 11f. privilege-escalation guard trigger must exist
SELECT t.tgname FROM pg_trigger t
WHERE t.tgrelid = to_regclass('public.profiles') AND NOT t.tgisinternal;

-- 11g. verification_codes must exist, have RLS, and have NO client grants
SELECT to_regclass('public.verification_codes') IS NOT NULL AS table_exists;
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'verification_codes'
  AND grantee IN ('anon', 'authenticated');

-- 11h. row counts (confirm nothing was deleted)
SELECT (SELECT count(*) FROM profiles)    AS profiles,
       (SELECT count(*) FROM jobs)        AS jobs,
       (SELECT count(*) FROM applications) AS applications,
       (SELECT count(*) FROM notifications) AS notifications,
       (SELECT count(*) FROM activities)  AS activities;
