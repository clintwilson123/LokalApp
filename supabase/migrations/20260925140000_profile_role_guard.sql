-- =============================================
-- SECURITY FIX: PROFILE ROLE / STATUS GUARD
--
-- RLS lets every user UPDATE their own profiles row
-- ("Users can update own profile"), which originally
-- allowed any user to set role='admin', status, or
-- email_verified=true on their own row.
--
-- Defense layers:
--   1. This trigger blocks role/status changes and
--      unverified email_verified=true for non-admins.
--   2. RLS (setup.sql / base migration) still blocks
--      updates to other users' rows entirely.
--
-- Trusted paths that carry no end-user JWT (SQL editor,
-- migrations, service-role requests from edge functions)
-- pass through unchanged.
-- =============================================

CREATE OR REPLACE FUNCTION public.profiles_security_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin BOOLEAN := FALSE;
  auth_confirmed TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) INTO caller_is_admin;

  IF TG_OP = 'INSERT' THEN
    IF NOT caller_is_admin THEN
      NEW.role := 'applicant';

      IF NEW.email_verified THEN
        SELECT email_confirmed_at INTO auth_confirmed
        FROM auth.users WHERE id = NEW.id;
        IF auth_confirmed IS NULL THEN
          NEW.email_verified := FALSE;
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NOT caller_is_admin THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Changing the profile role is not allowed';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Changing the profile status is not allowed';
    END IF;

    IF NEW.email_verified IS DISTINCT FROM OLD.email_verified THEN
      SELECT email_confirmed_at INTO auth_confirmed
        FROM auth.users WHERE id = NEW.id;
      IF NEW.email_verified IS NOT TRUE OR auth_confirmed IS NULL THEN
        RAISE EXCEPTION 'Email verification can only be set after the email is confirmed';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_security_guard ON public.profiles;

CREATE TRIGGER profiles_security_guard
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_security_guard();
