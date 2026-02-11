-- Permitir influenciadora criar candidatura pending
CREATE POLICY "Influencers can apply to campaigns"
ON public.campaign_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'influencer'::app_role)
  AND is_approved(auth.uid())
  AND influencer_id = auth.uid()
  AND status = 'pending'
);