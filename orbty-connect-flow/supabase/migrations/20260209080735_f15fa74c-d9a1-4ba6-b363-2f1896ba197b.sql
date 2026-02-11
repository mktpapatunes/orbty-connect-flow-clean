
-- Create trigger to auto-assign role from desired_role on profile insert
DROP TRIGGER IF EXISTS trg_ensure_user_role_from_profile ON public.profiles;

CREATE TRIGGER trg_ensure_user_role_from_profile
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_user_role_from_profile();

-- Backfill: insert missing roles for existing users with desired_role
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, p.desired_role
FROM public.profiles p
WHERE p.desired_role IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id)
ON CONFLICT (user_id) DO NOTHING;
