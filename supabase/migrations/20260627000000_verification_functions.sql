-- Sync phone from profiles to auth.users so signInWithOtp works
CREATE OR REPLACE FUNCTION sync_user_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM profiles WHERE phone_number = p_phone;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No account found with that phone number.';
  END IF;
  UPDATE auth.users SET phone = p_phone WHERE id = v_user_id;
  RETURN 'OK';
END;
$$;
