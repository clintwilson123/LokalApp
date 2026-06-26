-- =============================================
-- LOKALAPP FULL SCHEMA — Reference only
-- Run migration.sql in SQL Editor instead
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
