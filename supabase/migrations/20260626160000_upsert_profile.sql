-- Fix update_my_profile to UPSERT (creates profile row if missing)
CREATE OR REPLACE FUNCTION update_my_profile(p_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  INSERT INTO profiles (id, full_name, phone_number, location, skills, bio, resume_url, avatar_url, role, status)
  VALUES (
    auth.uid(),
    p_data->>'full_name',
    NULLIF(p_data->>'phone_number', ''),
    p_data->>'location',
    p_data->>'skills',
    p_data->>'bio',
    NULLIF(p_data->>'resume_url', ''),
    p_data->>'avatar_url',
    'applicant',
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name    = CASE WHEN p_data ? 'full_name'    THEN p_data->>'full_name'           ELSE profiles.full_name END,
    phone_number = CASE WHEN p_data ? 'phone_number' THEN NULLIF(p_data->>'phone_number', '') ELSE profiles.phone_number END,
    location     = CASE WHEN p_data ? 'location'     THEN p_data->>'location'            ELSE profiles.location END,
    skills       = CASE WHEN p_data ? 'skills'       THEN p_data->>'skills'              ELSE profiles.skills END,
    bio          = CASE WHEN p_data ? 'bio'          THEN p_data->>'bio'                 ELSE profiles.bio END,
    resume_url   = CASE WHEN p_data ? 'resume_url'   THEN NULLIF(p_data->>'resume_url', '')  ELSE profiles.resume_url END,
    avatar_url   = CASE WHEN p_data ? 'avatar_url'   THEN p_data->>'avatar_url'          ELSE profiles.avatar_url END;

  SELECT to_jsonb(p) INTO result FROM profiles p WHERE p.id = auth.uid();
  RETURN result;
END;
$$;
