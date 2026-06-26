-- Update update_my_profile to only change provided fields
CREATE OR REPLACE FUNCTION update_my_profile(p_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  UPDATE profiles
  SET
    full_name    = CASE WHEN p_data ? 'full_name'    THEN p_data->>'full_name'           ELSE full_name END,
    phone_number = CASE WHEN p_data ? 'phone_number' THEN NULLIF(p_data->>'phone_number', '') ELSE phone_number END,
    location     = CASE WHEN p_data ? 'location'     THEN p_data->>'location'            ELSE location END,
    skills       = CASE WHEN p_data ? 'skills'       THEN p_data->>'skills'              ELSE skills END,
    bio          = CASE WHEN p_data ? 'bio'          THEN p_data->>'bio'                 ELSE bio END,
    resume_url   = CASE WHEN p_data ? 'resume_url'   THEN NULLIF(p_data->>'resume_url', '')  ELSE resume_url END,
    avatar_url   = CASE WHEN p_data ? 'avatar_url'   THEN p_data->>'avatar_url'          ELSE avatar_url END
  WHERE id = auth.uid();

  SELECT to_jsonb(p) INTO result FROM profiles p WHERE p.id = auth.uid();
  RETURN result;
END;
$$;
