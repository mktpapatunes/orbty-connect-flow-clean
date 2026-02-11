-- Remover QUALQUER policy antiga que permita escrita direta
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own role during registration" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can delete own role" ON public.user_roles;

-- Bloquear INSERT direto
CREATE POLICY "No direct insert to user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Bloquear UPDATE direto
CREATE POLICY "No direct update to user_roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (false);

-- Bloquear DELETE direto
CREATE POLICY "No direct delete to user_roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (false);