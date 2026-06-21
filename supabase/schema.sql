-- =============================================
-- LOKALAPP COMPLETE SCHEMA — Copy & paste all
-- =============================================

-- Drop existing tables for clean re-run
DROP TABLE IF EXISTS interviews CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT CHECK (role IN ('admin', 'applicant')) DEFAULT 'applicant',
  status TEXT DEFAULT 'pending',
  phone TEXT,
  location TEXT,
  skills TEXT,
  resume_url TEXT,
  bio TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. JOBS
CREATE TABLE jobs (
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

-- 3. APPLICATIONS
CREATE TABLE applications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  job_id INT REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  score INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. NOTIFICATIONS
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT,
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. INTERVIEWS
CREATE TABLE interviews (
  id SERIAL PRIMARY KEY,
  application_id INT REFERENCES applications(id) ON DELETE CASCADE,
  date DATE,
  time TIME,
  location TEXT,
  instructions TEXT,
  status TEXT DEFAULT 'scheduled'
);

-- =============================================
-- SEED DATA — CJTECH Computer Trading jobs
-- =============================================
INSERT INTO jobs (title, company, location, salary, description, requirements, icon) VALUES
  ('Sales Assistant', 'CJTECH Computer Trading', 'Sangi, Toledo City', '₱15,000 — ₱18,000 / month', 'Assist customers with product inquiries, handle transactions, and maintain store cleanliness and organization.', ARRAY['High school graduate', 'Good communication skills', 'Basic math skills', 'Customer service'], '🛍️'),
  ('Computer Service', 'CJTECH Computer Trading', 'Sangi, Toledo City', '₱20,000 — ₱25,000 / month', 'Provide technical support, diagnose hardware/software issues, and perform repairs and maintenance.', ARRAY['IT-related course', 'Hardware troubleshooting', 'Software installation', 'Network basics'], '💻'),
  ('Repair Technician', 'CJTECH Computer Trading', 'Sangi, Toledo City', '₱18,000 — ₱22,000 / month', 'Diagnose and repair electronic devices, gadgets, and computer components with precision.', ARRAY['Technical vocational course', 'Soldering skills', 'Component-level repair', 'Multimeter usage'], '🔧'),
  ('Store Manager', 'CJTECH Computer Trading', 'Sangi, Toledo City', '₱30,000 — ₱35,000 / month', 'Oversee daily store operations, manage staff schedules, ensure sales targets are met, and report to headquarters.', ARRAY['Management experience', 'Leadership skills', 'Inventory management', 'Sales reporting'], '🏪');

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Allow insert during signup"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- APPLICATIONS
CREATE POLICY "Users can read own applications"
  ON applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all applications"
  ON applications FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can insert own applications"
  ON applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update applications"
  ON applications FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- NOTIFICATIONS
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- INTERVIEWS
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
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage interviews"
  ON interviews FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update interviews"
  ON interviews FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- JOBS
CREATE POLICY "Anyone can read jobs"
  ON jobs FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert jobs"
  ON jobs FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update jobs"
  ON jobs FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- BYPASS FUNCTION (used during login)
-- SECURITY DEFINER = runs as DB owner, skips RLS
-- =============================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- =============================================
-- FUNCTION: get profiles with auth emails (bypass RLS)
-- =============================================
CREATE OR REPLACE FUNCTION get_profiles_with_email()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  role TEXT,
  status TEXT,
  phone TEXT,
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
  SELECT p.id, p.full_name, p.role, p.status, p.phone, p.location, p.skills, p.resume_url, p.created_at, u.email
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC;
$$;

-- =============================================
-- ADMIN PROFILE SETUP
-- Change email if yours is different!
-- =============================================
DO $$
DECLARE
  user_uuid UUID;
BEGIN
  SELECT id INTO user_uuid FROM auth.users WHERE email = 'clintwilson.gonzales24@gmail.com';
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'No auth user found with that email. Create one in Authentication → Users first, then re-run this DO block.';
  END IF;

  -- Clean slate for this user
  DELETE FROM notifications WHERE user_id = user_uuid;
  DELETE FROM applications WHERE user_id = user_uuid;
  DELETE FROM profiles WHERE id = user_uuid;

  -- Insert admin profile
  INSERT INTO profiles (id, full_name, role, status)
  VALUES (user_uuid, 'Admin', 'admin', 'active');

  -- Set metadata fallback + auto-confirm email
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb,
      email_confirmed_at = NOW(),
      confirmed_at = DEFAULT
  WHERE id = user_uuid;
END $$;

-- =============================================
-- VERIFICATION
-- =============================================
SELECT p.id::text, p.full_name, p.role, p.status, au.email
FROM profiles p
JOIN auth.users au ON au.id = p.id
WHERE au.email = 'clintwilson.gonzales24@gmail.com';
