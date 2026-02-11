-- 1. Atualizar policy de SELECT para influencers: só vê campanhas com assignment ACCEPTED
DROP POLICY IF EXISTS "Influencers view assigned campaigns" ON public.campaigns;

CREATE POLICY "Influencers view accepted campaigns"
ON public.campaigns
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'influencer'::app_role)
  AND is_approved(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.campaign_assignments ca
    WHERE ca.campaign_id = campaigns.id
      AND ca.influencer_id = auth.uid()
      AND ca.status = 'accepted'
  )
);

-- 2. Permitir contractors atualizarem assignments das próprias campanhas (aprovar/recusar)
CREATE POLICY "Contractors can update own campaign assignments"
ON public.campaign_assignments
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'contractor'::app_role)
  AND is_approved(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.campaigns c
    WHERE c.id = campaign_assignments.campaign_id
      AND c.created_by = auth.uid()
  )
);

-- 3. RPC seguro para contractor ver candidatas com dados do perfil
CREATE OR REPLACE FUNCTION public.get_campaign_applicants(p_campaign_id uuid)
RETURNS TABLE (
  assignment_id uuid,
  influencer_id uuid,
  status text,
  assigned_at timestamptz,
  influencer_name text,
  influencer_instagram text,
  influencer_city text,
  influencer_state text,
  influencer_followers text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ca.id,
    ca.influencer_id,
    ca.status::text,
    ca.assigned_at,
    p.name,
    p.instagram,
    p.city,
    p.state,
    p.followers
  FROM public.campaign_assignments ca
  JOIN public.profiles p ON p.id = ca.influencer_id
  JOIN public.campaigns c ON c.id = ca.campaign_id
  WHERE ca.campaign_id = p_campaign_id
    AND c.created_by = auth.uid()
$$;

ALTER FUNCTION public.get_campaign_applicants(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_campaign_applicants(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_campaign_applicants(uuid) TO authenticated;