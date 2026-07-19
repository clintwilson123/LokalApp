-- Add security question columns (idempotent)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS security_question TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS security_answer TEXT DEFAULT '';

-- Look up security question by phone (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_security_question(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_question TEXT;
BEGIN
  SELECT security_question INTO v_question
  FROM profiles
  WHERE phone_number = p_phone;

  IF v_question IS NULL THEN
    RAISE EXCEPTION 'No account found with that phone number.';
  END IF;

  IF v_question = '' THEN
    RAISE EXCEPTION 'This account does not have a security question set.';
  END IF;

  RETURN v_question;
END;
$$;

-- Reset password by answering security question (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION reset_password_by_phone(p_phone TEXT, p_answer TEXT, p_new_password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_stored_answer TEXT;
BEGIN
  -- Look up user by phone
  SELECT id, security_answer INTO v_user_id, v_stored_answer
  FROM profiles
  WHERE phone_number = p_phone;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No account found with that phone number.';
  END IF;

  -- Verify answer (case-insensitive)
  IF v_stored_answer IS NULL OR v_stored_answer != lower(trim(p_answer)) THEN
    RAISE EXCEPTION 'Wrong answer.';
  END IF;

  -- Update password directly in auth.users
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = NOW()
  WHERE id = v_user_id;

  RETURN 'Password updated successfully.';
END;
$$;
