-- Drop old functions from previous approaches
DROP FUNCTION IF EXISTS get_security_question;
DROP FUNCTION IF EXISTS reset_password_by_phone;
DROP FUNCTION IF EXISTS sync_user_phone;

-- Ensure pgcrypto is available for crypt()/gen_salt()
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- Remove old columns
ALTER TABLE profiles DROP COLUMN IF EXISTS security_question;
ALTER TABLE profiles DROP COLUMN IF EXISTS security_answer;

-- Make sure preferences column exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- Generate and store a 6-digit code, returns it (shown in UI since no SMS yet)
CREATE OR REPLACE FUNCTION send_reset_code(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  v_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

  UPDATE profiles
  SET preferences = jsonb_set(
    COALESCE(preferences, '{}'::jsonb),
    '{reset_code}',
    to_jsonb(v_code)
  )
  WHERE phone_number = p_phone;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No account found with that phone number.';
  END IF;

  RETURN v_code;
END;
$$;

-- Verify that the code matches (returns 'OK' or throws)
CREATE OR REPLACE FUNCTION verify_reset_code(p_phone TEXT, p_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stored_code TEXT;
BEGIN
  SELECT preferences->>'reset_code' INTO v_stored_code
  FROM profiles
  WHERE phone_number = p_phone;

  IF v_stored_code IS NULL OR v_stored_code != p_code THEN
    RAISE EXCEPTION 'Invalid code.';
  END IF;

  RETURN 'OK';
END;
$$;

-- Update password (code must be verified first, then cleared)
CREATE OR REPLACE FUNCTION reset_with_code(p_phone TEXT, p_code TEXT, p_new_password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_stored_code TEXT;
BEGIN
  SELECT id, preferences->>'reset_code' INTO v_user_id, v_stored_code
  FROM profiles
  WHERE phone_number = p_phone;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No account found with that phone number.';
  END IF;

  IF v_stored_code IS NULL OR v_stored_code != p_code THEN
    RAISE EXCEPTION 'Invalid code.';
  END IF;

  -- Clear the used code
  UPDATE profiles SET preferences = preferences - 'reset_code' WHERE id = v_user_id;

  -- Update password directly in auth.users
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = NOW()
  WHERE id = v_user_id;

  RETURN 'Password updated successfully.';
END;
$$;
