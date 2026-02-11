-- Remover policies antigas inseguras
DROP POLICY IF EXISTS "Anyone can view invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Authenticated can view invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Authenticated users can read invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Public invite codes access" ON public.invite_codes;

-- Garantir RLS ativo
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- Bloquear SELECT para usuários comuns
CREATE POLICY "No direct select on invite_codes"
ON public.invite_codes
FOR SELECT
TO authenticated
USING (false);

-- Admin pode ver todos os códigos
CREATE POLICY "Admins can view all invite codes"
ON public.invite_codes
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Função segura para validar código de convite (usada no registro)
CREATE OR REPLACE FUNCTION public.validate_invite_code(_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.invite_codes
    WHERE code = UPPER(TRIM(_code))
      AND is_active = true
  )
$$;

-- Revogar acesso público e liberar apenas para autenticados
REVOKE EXECUTE ON FUNCTION public.validate_invite_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_invite_code(text) TO authenticated;