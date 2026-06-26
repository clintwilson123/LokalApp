-- =============================================
-- LOKALAPP — Run this in Supabase SQL Editor
-- Safe to re-run (no DROP, all IF NOT EXISTS)
-- =============================================

-- 1. TABLES (skip if exist)
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT,
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ADD MISSING COLUMNS (safe if exist)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 3. ENABLE RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- 4. SECURITY DEFINER FUNCTIONS (bypass RLS)
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

CREATE OR REPLACE FUNCTION update_my_profile(p_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  INSERT INTO profiles (id, full_name, phone_number, location, skills, bio, resume_url, avatar_url, role, status)
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
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name    = CASE WHEN p_data ? 'full_name'    THEN p_data->>'full_name'           ELSE profiles.full_name END,
    phone_number = CASE WHEN p_data ? 'phone_number' THEN NULLIF(p_data->>'phone_number', '') ELSE profiles.phone_number END,
    location     = CASE WHEN p_data ? 'location'     THEN p_data->>'location'            ELSE profiles.location END,
    skills       = CASE WHEN p_data ? 'skills'       THEN p_data->>'skills'              ELSE profiles.skills END,
    bio          = CASE WHEN p_data ? 'bio'          THEN p_data->>'bio'                 ELSE profiles.bio END,
    resume_url   = CASE WHEN p_data ? 'resume_url'   THEN NULLIF(p_data->>'resume_url', '')  ELSE profiles.resume_url END,
    avatar_url   = CASE WHEN p_data ? 'avatar_url'   THEN p_data->>'avatar_url'          ELSE profiles.avatar_url END;

  SELECT to_jsonb(p) INTO result FROM profiles p WHERE p.id = auth.uid();
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION get_profiles_with_email()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  role TEXT,
  status TEXT,
  phone_number TEXT,
  location TEXT,
  skills TEXT,
  resume_url TEXT,
  created_at TIMESTAMPTZ,
  email TEXT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT p.id, p.full_name, p.role, p.status, p.phone_number, p.location, p.skills, p.resume_url, p.created_at, u.email
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC;
$$;

-- 5. RLS POLICIES — drop old, recreate with is_admin()

-- PROFILES
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

-- APPLICATIONS
DROP POLICY IF EXISTS "Users can read own applications" ON applications;
DROP POLICY IF EXISTS "Admins can read all applications" ON applications;
DROP POLICY IF EXISTS "Users can insert own applications" ON applications;
DROP POLICY IF EXISTS "Admins can update applications" ON applications;

CREATE POLICY "Users can read own applications"
  ON applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all applications"
  ON applications FOR SELECT
  USING (is_admin());

CREATE POLICY "Users can insert own applications"
  ON applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update applications"
  ON applications FOR UPDATE
  USING (is_admin());

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- JOBS
DROP POLICY IF EXISTS "Anyone can read jobs" ON jobs;
DROP POLICY IF EXISTS "Admins can insert jobs" ON jobs;
DROP POLICY IF EXISTS "Admins can update jobs" ON jobs;

CREATE POLICY "Anyone can read jobs"
  ON jobs FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert jobs"
  ON jobs FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update jobs"
  ON jobs FOR UPDATE
  USING (is_admin());

-- 6. SEED JOBS
INSERT INTO jobs (title, company, location, salary, description, requirements, icon)
SELECT 'Sales Assistant', 'CJTECH Computer Trading', 'Sangi, Toledo City', '₱15,000 — ₱18,000 / month', 'Assist customers with product inquiries, handle transactions, and maintain store cleanliness and organization.', ARRAY['High school graduate', 'Good communication skills', 'Basic math skills', 'Customer service'], '🛍️'
WHERE NOT EXISTS (SELECT 1 FROM jobs LIMIT 1);

INSERT INTO jobs (title, company, location, salary, description, requirements, icon)
SELECT 'Computer Service', 'CJTECH Computer Trading', 'Sangi, Toledo City', '₱20,000 — ₱25,000 / month', 'Provide technical support, diagnose hardware/software issues, and perform repairs and maintenance.', ARRAY['IT-related course', 'Hardware troubleshooting', 'Software installation', 'Network basics'], '💻'
WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE title = 'Computer Service');

INSERT INTO jobs (title, company, location, salary, description, requirements, icon)
SELECT 'Repair Technician', 'CJTECH Computer Trading', 'Sangi, Toledo City', '₱18,000 — ₱22,000 / month', 'Diagnose and repair electronic devices, gadgets, and computer components with precision.', ARRAY['Technical vocational course', 'Soldering skills', 'Component-level repair', 'Multimeter usage'], '🔧'
WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE title = 'Repair Technician');

INSERT INTO jobs (title, company, location, salary, description, requirements, icon)
SELECT 'Store Manager', 'CJTECH Computer Trading', 'Sangi, Toledo City', '₱30,000 — ₱35,000 / month', 'Oversee daily store operations, manage staff schedules, ensure sales targets are met, and report to headquarters.', ARRAY['Management experience', 'Leadership skills', 'Inventory management', 'Sales reporting'], '🏪'
WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE title = 'Store Manager');

-- 7. ADMIN SETUP — change email to yours
DO $$
DECLARE
  user_uuid UUID;
BEGIN
  SELECT id INTO user_uuid FROM auth.users WHERE email = 'clintwilson.gonzales24@gmail.com';
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'Admin email not found in auth.users. Create the user in Authentication → Users first.';
  END IF;

  DELETE FROM notifications WHERE user_id = user_uuid;
  DELETE FROM applications WHERE user_id = user_uuid;
  DELETE FROM profiles WHERE id = user_uuid;

  INSERT INTO profiles (id, full_name, role, status)
  VALUES (user_uuid, 'Admin', 'admin', 'active');

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb,
      email_confirmed_at = NOW(),
      confirmed_at = DEFAULT
  WHERE id = user_uuid;
END $$;

-- 8. STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public)
SELECT 'resumes', 'resumes', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'resumes');

DROP POLICY IF EXISTS "Users can upload their own resumes" ON storage.objects;
DROP POLICY IF EXISTS "Resumes are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;

CREATE POLICY "Users can upload their own resumes"
  ON storage.objects FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND bucket_id = 'resumes'
  );

CREATE POLICY "Resumes are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resumes');

CREATE POLICY "Users can update their own files"
  ON storage.objects FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND bucket_id = 'resumes'
  );

-- 9. VERIFY
SELECT p.id::text, p.full_name, p.role, p.status, au.email
FROM profiles p
JOIN auth.users au ON au.id = p.id
WHERE au.email = 'clintwilson.gonzales24@gmail.com';
