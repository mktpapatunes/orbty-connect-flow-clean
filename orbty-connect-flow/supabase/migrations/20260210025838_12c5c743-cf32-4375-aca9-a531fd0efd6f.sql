
CREATE OR REPLACE FUNCTION public.create_campaign(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_id uuid;
  uid uuid := auth.uid();
BEGIN
  IF NOT public.has_role(uid, 'contractor') THEN
    RAISE EXCEPTION 'Permission denied: not a contractor';
  END IF;
  IF NOT public.is_approved(uid) THEN
    RAISE EXCEPTION 'Permission denied: not approved';
  END IF;

  IF payload->>'title' IS NULL OR
     payload->>'type' IS NULL OR
     payload->>'region' IS NULL OR
     payload->>'state' IS NULL OR
     payload->>'city' IS NULL OR
     payload->>'apply_deadline' IS NULL OR
     payload->>'brief_public' IS NULL OR
     COALESCE((payload->'requirements'->>'posts')::int, 0) < 1 THEN
    RAISE EXCEPTION 'Missing required fields';
  END IF;

  INSERT INTO public.campaigns (
    created_by, title, type, region, state, city,
    campaign_date, apply_deadline, brief_public, brief_private,
    requirements, status
  ) VALUES (
    uid,
    payload->>'title',
    payload->>'type',
    payload->>'region',
    payload->>'state',
    payload->>'city',
    (payload->>'campaign_date')::date,
    (payload->>'apply_deadline')::date,
    payload->>'brief_public',
    payload->>'brief_private',
    COALESCE(payload->'requirements', '{}'::jsonb),
    'active'
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;
