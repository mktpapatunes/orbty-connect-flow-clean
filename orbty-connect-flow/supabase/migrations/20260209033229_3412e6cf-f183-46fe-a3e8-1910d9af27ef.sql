-- Remover policies de SELECT existentes que serão substituídas
DROP POLICY IF EXISTS "Contractors can view own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Influencers can view active campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins can view all campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Authenticated users can view campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can view active campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Public campaigns access" ON public.campaigns;

-- Garantir RLS ativo
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Contractor vê apenas as próprias campanhas
CREATE POLICY "Contractors view own campaigns"
ON public.campaigns
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'contractor'::app_role)
  AND created_by = auth.uid()
);

-- Influencer vê apenas campanhas onde está vinculada (via campaign_assignments)
CREATE POLICY "Influencers view assigned campaigns"
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
  )
);

-- Admin vê todas
CREATE POLICY "Admins view all campaigns"
ON public.campaigns
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
);