
-- Function: handle_new_user
-- Runs as SECURITY DEFINER so it can insert into profiles and user_roles
-- regardless of the caller's session/role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _meta jsonb;
  _role text;
  _invite_code text;
  _has_valid_code boolean := false;
BEGIN
  _meta := NEW.raw_user_meta_data;

  -- Only proceed if we have profile metadata (i.e. came from our signup form)
  IF _meta IS NULL OR _meta->>'name' IS NULL THEN
    RETURN NEW;
  END IF;

  _role := _meta->>'role';
  _invite_code := _meta->>'invite_code';

  -- Validate invite code if provided
  IF _invite_code IS NOT NULL AND _invite_code <> '' THEN
    _has_valid_code := public.validate_invite_code(_invite_code);
  END IF;

  -- Insert profile
  INSERT INTO public.profiles (
    id, name, email, phone, city, state,
    instagram, followers, invite_code, has_invite_code, desired_role
  ) VALUES (
    NEW.id,
    COALESCE(_meta->>'name', ''),
    COALESCE(_meta->>'email', NEW.email),
    COALESCE(_meta->>'phone', ''),
    COALESCE(_meta->>'city', ''),
    COALESCE(_meta->>'state', ''),
    NULLIF(_meta->>'instagram', ''),
    NULLIF(_meta->>'followers', ''),
    NULLIF(_invite_code, ''),
    _has_valid_code,
    CASE WHEN _role IN ('contractor', 'influencer') THEN _role::app_role ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert role (never allow admin via metadata)
  IF _role IN ('contractor', 'influencer') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, _role::app_role)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
