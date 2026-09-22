-- =============================================
-- FIX: Add all missing columns and tables
-- Run this in Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS)
-- =============================================

-- Add missing columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consent_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consent_accepted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- Add missing column to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS max_applicants INT DEFAULT 0;

-- Create hiring_policy table
CREATE TABLE IF NOT EXISTS hiring_policy (
  id SERIAL PRIMARY KEY,
  employer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  policy_text TEXT NOT NULL DEFAULT 'I agree to provide accurate information in my application.',
  requires_acknowledgment BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create hiring_policy_acknowledgments table
CREATE TABLE IF NOT EXISTS hiring_policy_acknowledgments (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_id INT REFERENCES hiring_policy(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, policy_id)
);

-- Enable RLS on new tables
ALTER TABLE hiring_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE hiring_policy_acknowledgments ENABLE ROW LEVEL SECURITY;

-- RLS policies for hiring_policy
DROP POLICY IF EXISTS "Anyone can read hiring policy" ON hiring_policy;
DROP POLICY IF EXISTS "Admins can manage hiring policy" ON hiring_policy;
CREATE POLICY "Anyone can read hiring policy" ON hiring_policy FOR SELECT USING (true);
CREATE POLICY "Admins can manage hiring policy" ON hiring_policy FOR ALL USING (is_admin());

-- RLS policies for hiring_policy_acknowledgments
DROP POLICY IF EXISTS "Users can read own acknowledgments" ON hiring_policy_acknowledgments;
DROP POLICY IF EXISTS "Users can insert own acknowledgments" ON hiring_policy_acknowledgments;
CREATE POLICY "Users can read own acknowledgments" ON hiring_policy_acknowledgments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own acknowledgments" ON hiring_policy_acknowledgments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add index
CREATE INDEX IF NOT EXISTS idx_hiring_policy_ack_user ON hiring_policy_acknowledgments(user_id);

-- Update update_my_profile to handle consent columns
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

-- Fix any user with wrong role (uncomment and change email if needed)
-- UPDATE profiles SET role = 'applicant' WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR_USER_EMAIL_HERE') AND role = 'admin' AND email != 'admin@gmail.com';

-- Verify
SELECT p.full_name, p.role, p.status, p.email_verified, p.consent_accepted, au.email
FROM profiles p
JOIN auth.users au ON au.id = p.id;
