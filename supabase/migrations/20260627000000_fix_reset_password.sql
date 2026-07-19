DROP FUNCTION IF EXISTS reset_with_code;
DROP FUNCTION IF EXISTS verify_code_get_user_id;
DROP FUNCTION IF EXISTS verify_reset_code;

-- Verify code and return the user's email (used by ForgotPassword frontend)
-- Uses auth.users join so caller gets the email needed for resetPasswordForEmail
CREATE OR REPLACE FUNCTION verify_code_get_email(p_phone TEXT, p_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_stored_code TEXT;
BEGIN
  SELECT p.id, u.email, p.preferences->>'reset_code'
  INTO v_user_id, v_email, v_stored_code
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.phone_number = p_phone;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No account found with that phone number.';
  END IF;

  IF v_stored_code IS NULL OR v_stored_code != p_code THEN
    RAISE EXCEPTION 'Invalid code.';
  END IF;

  UPDATE profiles SET preferences = preferences - 'reset_code' WHERE id = v_user_id;

  RETURN v_email;
END;
$$;
