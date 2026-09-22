-- =============================================
-- EMAIL VERIFICATION OTP CODES
-- Run this in Supabase SQL Editor
-- Safe to re-run
-- =============================================

CREATE TABLE IF NOT EXISTS verification_codes (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'signup' CHECK (purpose IN ('signup', 'password_reset')),
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_user ON verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_code ON verification_codes(code);

ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Users can read their own codes (for verification)
DROP POLICY IF EXISTS "Users can read own verification codes" ON verification_codes;
CREATE POLICY "Users can read own verification codes"
  ON verification_codes FOR SELECT
  USING (auth.uid() = user_id);

-- System can insert codes
DROP POLICY IF EXISTS "System can insert verification codes" ON verification_codes;
CREATE POLICY "System can insert verification codes"
  ON verification_codes FOR INSERT
  WITH CHECK (true);

-- System can update codes (mark as used)
DROP POLICY IF EXISTS "System can update verification codes" ON verification_codes;
CREATE POLICY "System can update verification codes"
  ON verification_codes FOR UPDATE
  USING (true);
