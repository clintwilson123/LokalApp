-- DROP IF EXISTS
DROP FUNCTION IF EXISTS reset_with_code;

-- Verify code and return the user_id (used by ForgotPassword frontend)
CREATE OR REPLACE FUNCTION verify_code_get_user_id(p_phone TEXT, p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  RETURN v_user_id;
END;
$$;
