-- Remover TODAS as policies de SELECT existentes na profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles access" ON public.profiles;

-- Remover TODAS as policies de UPDATE existentes na profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile except status" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

-- Garantir RLS ativo
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: Usuário vê apenas o próprio perfil
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- SELECT: Admin vê todos
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- UPDATE: Usuário edita próprio perfil (mas NÃO pode alterar approval_status)
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND approval_status = (SELECT p.approval_status FROM public.profiles p WHERE p.id = auth.uid())
);

-- UPDATE: Admin pode atualizar qualquer perfil
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));