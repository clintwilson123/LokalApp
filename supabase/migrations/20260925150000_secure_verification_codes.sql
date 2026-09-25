-- =============================================
-- SECURITY FIX: VERIFICATION CODES LOCKDOWN
--
-- 1) Brute-force protection: add an attempt counter.
--    verify-otp-code invalidates a code after 5 wrong
--    guesses; requesting a new code resets the counter
--    (send-verification-code deletes unused rows first).
--
-- 2) Remove the permissive client policies from
--    20260916100000_verification_codes.sql and revoke
--    all client grants. OTP codes must never be
--    readable or writable through the Data API —
--    only edge functions (service role, which bypasses
--    RLS) touch this table.
--
-- Idempotent — safe to re-run.
-- =============================================

ALTER TABLE public.verification_codes
  ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;

ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own verification codes" ON public.verification_codes;
DROP POLICY IF EXISTS "System can insert verification codes" ON public.verification_codes;
DROP POLICY IF EXISTS "System can update verification codes" ON public.verification_codes;

REVOKE ALL ON public.verification_codes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_codes TO service_role;
