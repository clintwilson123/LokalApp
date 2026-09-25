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

-- SECURITY: no client-accessible policies.
-- OTP codes must never be readable (own-row reads leak the OTP around
-- email possession) or writable (WITH CHECK/USING true = anyone) through
-- the Data API. Only edge functions access this table via the service
-- role, which bypasses RLS. Client grants are revoked in
-- 20260925150000_secure_verification_codes.sql.
-- Drop the old permissive policies if they exist (safe to re-run).
DROP POLICY IF EXISTS "Users can read own verification codes" ON verification_codes;
DROP POLICY IF EXISTS "System can insert verification codes" ON verification_codes;
DROP POLICY IF EXISTS "System can update verification codes" ON verification_codes;
