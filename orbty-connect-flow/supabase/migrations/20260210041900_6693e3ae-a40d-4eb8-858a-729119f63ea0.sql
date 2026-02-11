
-- ============================
-- 1) FIX: "permission denied for table profiles"
-- ============================
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.profiles FROM public;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================
-- 2) Campos extras para Perfil do Creator
-- ============================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS content_style text,
  ADD COLUMN IF NOT EXISTS audience_gender jsonb DEFAULT '{"female":50,"male":50}'::jsonb;

-- ============================
-- 3) RPC segura p/ atualizar perfil
-- ============================
CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_avatar_url text DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_neighborhood text DEFAULT NULL,
  p_age integer DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_content_style text DEFAULT NULL,
  p_audience_gender jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    name = COALESCE(p_name, name),
    bio = COALESCE(p_bio, bio),
    neighborhood = COALESCE(p_neighborhood, neighborhood),
    age = COALESCE(p_age, age),
    gender = COALESCE(p_gender, gender),
    content_style = COALESCE(p_content_style, content_style),
    audience_gender = COALESCE(p_audience_gender, audience_gender),
    updated_at = now()
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_profile(text,text,text,text,integer,text,text,jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text,text,text,text,integer,text,text,jsonb) TO authenticated;
