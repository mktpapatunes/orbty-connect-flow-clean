
-- RPC: Listar usuários com role (admin only)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  instagram text,
  city text,
  state text,
  followers text,
  phone text,
  approval_status text,
  has_invite_code boolean,
  invite_code text,
  created_at timestamptz,
  updated_at timestamptz,
  role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.name,
    p.email,
    p.instagram,
    p.city,
    p.state,
    p.followers,
    p.phone,
    p.approval_status::text,
    p.has_invite_code,
    p.invite_code,
    p.created_at,
    p.updated_at,
    ur.role::text
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY p.created_at DESC;
$$;

-- RPC: Listar invite codes (admin only)
CREATE OR REPLACE FUNCTION public.admin_list_invite_codes()
RETURNS TABLE (
  id uuid,
  code text,
  is_active boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ic.id, ic.code, ic.is_active, ic.created_at
  FROM public.invite_codes ic
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY ic.created_at DESC;
$$;

-- RPC: Aprovar usuário (admin only)
CREATE OR REPLACE FUNCTION public.admin_approve_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  UPDATE public.profiles
  SET approval_status = 'approved', updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- RPC: Rejeitar usuário (admin only)
CREATE OR REPLACE FUNCTION public.admin_reject_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  UPDATE public.profiles
  SET approval_status = 'rejected', updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- RPC: Criar invite code (admin only)
CREATE OR REPLACE FUNCTION public.admin_create_invite_code(p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  INSERT INTO public.invite_codes (code, is_active)
  VALUES (UPPER(TRIM(p_code)), true);
END;
$$;

-- RPC: Ativar/desativar invite code (admin only)
CREATE OR REPLACE FUNCTION public.admin_toggle_invite_code(p_code_id uuid, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  UPDATE public.invite_codes
  SET is_active = p_active
  WHERE id = p_code_id;
END;
$$;
