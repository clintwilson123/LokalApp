-- Add signup_risk_level column to profiles table
-- Stores the risk assessment from Gmail validation during signup

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signup_risk_level TEXT DEFAULT 'low';

-- Update RLS policy to allow admins to view signup_risk_level
-- (existing admin policies already cover this since they can select all columns)

-- Add index for admin filtering by risk level
CREATE INDEX IF NOT EXISTS idx_profiles_signup_risk ON profiles (signup_risk_level);
