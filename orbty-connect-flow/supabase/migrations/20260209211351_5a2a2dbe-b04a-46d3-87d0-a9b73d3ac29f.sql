
-- =========================================
-- ORBTY - Security lockdown + admin role RPC
-- =========================================

-- 1) Revoke table access from anon/public
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.profiles FROM public;

-- Keep authenticated access controlled only via RLS
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;

-- 2) Remove any overly permissive SELECT policies (defensive cleanup)
DROP POLICY IF EXISTS "Public profiles access" ON public.profiles;
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- 3) Recreate strict UPDATE policy (prevents user from changing own approval_status)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND approval_status = (SELECT p.approval_status FROM public.profiles p WHERE p.id = auth.uid())
);

-- 4) Create admin_set_user_role RPC
CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  IF p_role NOT IN ('admin', 'contractor', 'influencer') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  -- Prevent admin from removing their own admin role
  IF auth.uid() = p_user_id AND p_role <> 'admin' THEN
    RAISE EXCEPTION 'You cannot remove your own admin role';
  END IF;

  -- Upsert role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_role::app_role)
  ON CONFLICT (user_id)
  DO UPDATE SET role = EXCLUDED.role;
END;
$$;

ALTER FUNCTION public.admin_set_user_role(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;
