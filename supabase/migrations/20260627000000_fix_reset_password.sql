-- Restore original functions from clean_reset.sql
-- (undoes all my experimental changes and goes back to original crypt() approach)

DROP FUNCTION IF EXISTS verify_code;
DROP FUNCTION IF EXISTS verify_code_get_user_id;
DROP FUNCTION IF EXISTS verify_code_get_email;

-- Recreate verify_reset_code (might have been dropped)
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

-- Recreate reset_with_code with original crypt() approach
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

  UPDATE profiles SET preferences = preferences - 'reset_code' WHERE id = v_user_id;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = NOW()
  WHERE id = v_user_id;

  RETURN 'Password updated successfully.';
END;
$$;
