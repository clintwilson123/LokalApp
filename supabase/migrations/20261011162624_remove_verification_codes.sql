-- =============================================
-- REMOVE VERIFICATION_CODES TABLE
-- The OTP flow now uses Supabase Auth's Send Email Hook
-- (send-auth-email -> EmailJS) with GoTrue-native verifyOtp().
-- The custom verification_codes table, send-verification-code
-- and verify-otp-code Edge Functions are no longer used.
-- =============================================

-- Drop indexes first (Postgres does this automatically with DROP TABLE,
-- but explicit drops are safe to re-run)
DROP INDEX IF EXISTS idx_verification_codes_user;
DROP INDEX IF EXISTS idx_verification_codes_code;

-- Drop the table
DROP TABLE IF EXISTS verification_codes;

-- Revoke any lingering grants (no-op if the table is gone, but safe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'verification_codes') THEN
    REVOKE ALL ON verification_codes FROM anon, authenticated;
  END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
