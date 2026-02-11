
-- 1. Fix: Users should NOT be able to change their own approval_status
-- Drop the old permissive update policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create a new update policy that prevents changing approval_status
CREATE POLICY "Users can update own profile except status"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND approval_status = (SELECT approval_status FROM public.profiles WHERE id = auth.uid())
);

-- 2. Fix: Influencer assignment updates should require approved status
DROP POLICY IF EXISTS "Influencers can update own assignments" ON public.campaign_assignments;

CREATE POLICY "Approved influencers can update own assignments"
ON public.campaign_assignments
FOR UPDATE
TO authenticated
USING (influencer_id = auth.uid() AND is_approved(auth.uid()));

-- 3. Add database-level constraints for input validation
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_name_length CHECK (char_length(name) BETWEEN 1 AND 200),
  ADD CONSTRAINT profiles_email_length CHECK (char_length(email) BETWEEN 3 AND 255),
  ADD CONSTRAINT profiles_phone_length CHECK (char_length(phone) BETWEEN 8 AND 30),
  ADD CONSTRAINT profiles_city_length CHECK (char_length(city) BETWEEN 1 AND 100),
  ADD CONSTRAINT profiles_state_length CHECK (char_length(state) BETWEEN 2 AND 50);

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_title_length CHECK (char_length(title) BETWEEN 1 AND 300),
  ADD CONSTRAINT campaigns_brand_length CHECK (char_length(brand) BETWEEN 1 AND 200);
