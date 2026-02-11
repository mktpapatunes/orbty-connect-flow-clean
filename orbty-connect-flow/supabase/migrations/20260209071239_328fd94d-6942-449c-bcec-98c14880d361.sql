
-- Create the missing assign_registration_role RPC
-- Allows a newly signed-up user to assign their own role (contractor/influencer only)
CREATE OR REPLACE FUNCTION public.assign_registration_role(_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow contractor or influencer
  IF _role NOT IN ('contractor', 'influencer') THEN
    RAISE EXCEPTION 'Invalid role: %. Only contractor or influencer allowed.', _role;
  END IF;

  -- Don't create duplicate roles
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()) THEN
    RETURN;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), _role::app_role);
END;
$$;
