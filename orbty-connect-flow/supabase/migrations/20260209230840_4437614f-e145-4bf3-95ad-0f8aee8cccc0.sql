
-- =========================
-- ORBTY: Auth Context + Roles + Public Feed (FIX PACK)
-- =========================

-- 1) Ensure RLS is enabled
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_assignments ENABLE ROW LEVEL SECURITY;

-- 2) HARDEN profiles against anon
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.profiles FROM public;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;

-- 3) RPC: get_my_context
CREATE OR REPLACE FUNCTION public.get_my_context()
RETURNS TABLE (role text, approval_status text, profile_exists boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = auth.uid() LIMIT 1),
    (SELECT p.approval_status::text FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1),
    EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid());
$$;

ALTER FUNCTION public.get_my_context() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_my_context() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_context() TO authenticated;

-- 4) RPC: get_campaigns_public_feed
CREATE OR REPLACE FUNCTION public.get_campaigns_public_feed()
RETURNS TABLE (id uuid, title text, brand text, type text, region text, posts text, campaign_date text, status text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.title, c.brand, c.type, c.region, c.posts, c.campaign_date, c.status::text, c.created_at
  FROM public.campaigns c WHERE c.status = 'active';
$$;

ALTER FUNCTION public.get_campaigns_public_feed() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_campaigns_public_feed() FROM public;
GRANT EXECUTE ON FUNCTION public.get_campaigns_public_feed() TO authenticated;

-- 5) RPC: assign_registration_role
CREATE OR REPLACE FUNCTION public.assign_registration_role(_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _role NOT IN ('contractor', 'influencer') THEN
    RAISE EXCEPTION 'Invalid role: %', _role;
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), _role::app_role)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

ALTER FUNCTION public.assign_registration_role(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.assign_registration_role(text) FROM public;
GRANT EXECUTE ON FUNCTION public.assign_registration_role(text) TO authenticated;

-- 6) Trigger function: ensure_user_role_from_profile
CREATE OR REPLACE FUNCTION public.ensure_user_role_from_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.desired_role IS NULL OR NEW.desired_role NOT IN ('contractor','influencer') THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, NEW.desired_role::app_role)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 7) Create trigger if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ensure_user_role_from_profile') THEN
    CREATE TRIGGER trg_ensure_user_role_from_profile
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.ensure_user_role_from_profile();
  END IF;
END $$;

-- 8) Backfill missing roles
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, p.desired_role::app_role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
WHERE ur.user_id IS NULL AND p.desired_role IN ('contractor','influencer');

-- 9) Admin role management RPC
CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id uuid, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;
  IF p_role NOT IN ('admin','contractor','influencer') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  IF auth.uid() = p_user_id AND p_role <> 'admin' THEN
    RAISE EXCEPTION 'You cannot remove your own admin role';
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_role::app_role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;

ALTER FUNCTION public.admin_set_user_role(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;
