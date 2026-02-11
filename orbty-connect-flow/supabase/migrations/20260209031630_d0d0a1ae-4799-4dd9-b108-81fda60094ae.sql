
CREATE OR REPLACE FUNCTION public.set_activity_log_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
BEGIN
  -- 1) Impedir criação de log para outro usuário
  IF NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Cannot create log for another user';
  END IF;

  -- 2) Buscar role real do banco
  SELECT role INTO _role
  FROM public.user_roles
  WHERE user_id = NEW.user_id
  LIMIT 1;

  -- Impedir log sem role válido
  IF _role IS NULL THEN
    RAISE EXCEPTION 'User role not found for activity log';
  END IF;

  NEW.user_role := _role;
  RETURN NEW;
END;
$$;
