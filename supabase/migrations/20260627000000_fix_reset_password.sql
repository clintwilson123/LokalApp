-- Enable pg_net for HTTP calls to Auth Admin API
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop old functions
DROP FUNCTION IF EXISTS reset_with_code;
DROP FUNCTION IF EXISTS verify_code_get_user_id;
DROP FUNCTION IF EXISTS verify_code_get_email;
DROP FUNCTION IF EXISTS verify_reset_code;

-- Verify code without updating password (used in step 1 of forgot password)
CREATE OR REPLACE FUNCTION verify_code(p_phone TEXT, p_code TEXT)
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

-- Reset password by calling Supabase Auth Admin API via pg_net
-- This properly syncs with the Auth service (unlike direct encrypted_password update)
CREATE OR REPLACE FUNCTION reset_with_code(p_phone TEXT, p_code TEXT, p_new_password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, net
AS $$
DECLARE
  v_user_id UUID;
  v_stored_code TEXT;
  v_project_url TEXT;
  v_service_key TEXT;
  v_request_id BIGINT;
  v_status INT;
  v_error TEXT;
BEGIN
  -- Verify code and get user
  SELECT id, preferences->>'reset_code' INTO v_user_id, v_stored_code
  FROM profiles
  WHERE phone_number = p_phone;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No account found with that phone number.';
  END IF;

  IF v_stored_code IS NULL OR v_stored_code != p_code THEN
    RAISE EXCEPTION 'Invalid code.';
  END IF;

  -- Get project config (set via ALTER DATABASE in SQL Editor)
  v_project_url := current_setting('app.settings.project_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);

  IF v_project_url IS NULL OR v_service_key IS NULL THEN
    RAISE EXCEPTION 'Server not configured. Contact administrator.';
  END IF;

  -- Clear the used code (before API call so code is consumed)
  UPDATE profiles SET preferences = preferences - 'reset_code' WHERE id = v_user_id;

  -- Call Auth Admin API to update password (sync via pg_net)
  v_request_id := net.http_post(
    v_project_url || '/auth/v1/admin/users/' || v_user_id,
    jsonb_build_object('password', p_new_password)::text,
    jsonb_build_object(
      'Authorization', 'Bearer ' || v_service_key,
      'Content-Type', 'application/json',
      'apikey', v_service_key
    )::jsonb
  );

  -- Wait for response
  SELECT status_code, error_msg INTO v_status, v_error
  FROM net.http_collect_response(v_request_id, wait_for => true);

  IF v_status IS NOT NULL AND v_status >= 300 THEN
    RAISE EXCEPTION 'Password update failed: %', COALESCE(v_error, 'API error (code ' || v_status || ')');
  END IF;

  RETURN 'Password updated successfully.';
END;
$$;
