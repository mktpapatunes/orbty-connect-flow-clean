
-- ============================================================
-- ORBTY Campaign System - Full Rebuild
-- ============================================================

-- 1. Drop old dependent tables
DROP TABLE IF EXISTS public.campaign_assignments CASCADE;

-- 2. Drop old RPCs (will be recreated with new signatures)
DROP FUNCTION IF EXISTS public.get_campaigns_public_feed();
DROP FUNCTION IF EXISTS public.get_campaign_applicants(uuid);
DROP FUNCTION IF EXISTS public.get_my_context();

-- 3. Drop old RLS policies on campaigns
DROP POLICY IF EXISTS "Approved contractors can create campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Contractors can update own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins can update any campaign" ON public.campaigns;
DROP POLICY IF EXISTS "Contractors view own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins view all campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Influencers view accepted campaigns" ON public.campaigns;

-- 4. Truncate campaigns (schema changing significantly, dev data only)
TRUNCATE public.campaigns CASCADE;

-- 5. Alter campaigns - remove old columns
ALTER TABLE public.campaigns
  DROP COLUMN IF EXISTS brand,
  DROP COLUMN IF EXISTS value,
  DROP COLUMN IF EXISTS posts,
  DROP COLUMN IF EXISTS briefing,
  DROP COLUMN IF EXISTS material,
  DROP COLUMN IF EXISTS link;

-- 6. Change status from enum to text
ALTER TABLE public.campaigns
  ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.campaigns
  ALTER COLUMN status SET DEFAULT 'draft';

-- 7. Change campaign_date to date type
ALTER TABLE public.campaigns
  ALTER COLUMN campaign_date TYPE date USING campaign_date::date;

-- 8. Add new columns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS apply_deadline date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days')::date,
  ADD COLUMN IF NOT EXISTS brief_public text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS brief_private text,
  ADD COLUMN IF NOT EXISTS requirements jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ============================================================
-- 9. Create campaign_assets table
-- ============================================================
CREATE TABLE public.campaign_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  path text NOT NULL,
  label text,
  mime text,
  size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campaign_assets ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 10. Create campaign_applications table
-- ============================================================
CREATE TABLE public.campaign_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, influencer_id)
);
ALTER TABLE public.campaign_applications ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_campaign_applications_updated_at
  BEFORE UPDATE ON public.campaign_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 11. RLS - campaigns
-- ============================================================
CREATE POLICY "Contractors select own campaigns"
  ON public.campaigns FOR SELECT
  USING (has_role(auth.uid(), 'contractor') AND created_by = auth.uid());

CREATE POLICY "Contractors insert own campaigns"
  ON public.campaigns FOR INSERT
  WITH CHECK (created_by = auth.uid() AND has_role(auth.uid(), 'contractor') AND is_approved(auth.uid()));

CREATE POLICY "Contractors update own campaigns"
  ON public.campaigns FOR UPDATE
  USING (created_by = auth.uid() AND has_role(auth.uid(), 'contractor'));

CREATE POLICY "Admins select all campaigns"
  ON public.campaigns FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update any campaign"
  ON public.campaigns FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Influencers view accepted campaigns"
  ON public.campaigns FOR SELECT
  USING (
    has_role(auth.uid(), 'influencer') AND is_approved(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.campaign_applications ca
      WHERE ca.campaign_id = campaigns.id
        AND ca.influencer_id = auth.uid()
        AND ca.status = 'accepted'
    )
  );

-- ============================================================
-- 12. RLS - campaign_applications
-- ============================================================
CREATE POLICY "Influencers insert own applications"
  ON public.campaign_applications FOR INSERT
  WITH CHECK (
    influencer_id = auth.uid()
    AND has_role(auth.uid(), 'influencer')
    AND is_approved(auth.uid())
    AND status = 'pending'
  );

CREATE POLICY "Influencers select own applications"
  ON public.campaign_applications FOR SELECT
  USING (influencer_id = auth.uid());

CREATE POLICY "Contractors select campaign applications"
  ON public.campaign_applications FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_applications.campaign_id AND c.created_by = auth.uid()
  ));

CREATE POLICY "Contractors update campaign applications"
  ON public.campaign_applications FOR UPDATE
  USING (
    has_role(auth.uid(), 'contractor') AND is_approved(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_applications.campaign_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Admins select all applications"
  ON public.campaign_applications FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- ============================================================
-- 13. RLS - campaign_assets
-- ============================================================
CREATE POLICY "Contractors insert own campaign assets"
  ON public.campaign_assets FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_assets.campaign_id AND c.created_by = auth.uid()
  ));

CREATE POLICY "Contractors select own campaign assets"
  ON public.campaign_assets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_assets.campaign_id AND c.created_by = auth.uid()
  ));

CREATE POLICY "Contractors update own campaign assets"
  ON public.campaign_assets FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_assets.campaign_id AND c.created_by = auth.uid()
  ));

CREATE POLICY "Contractors delete own campaign assets"
  ON public.campaign_assets FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_assets.campaign_id AND c.created_by = auth.uid()
  ));

CREATE POLICY "Accepted influencers select campaign assets"
  ON public.campaign_assets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.campaign_applications ca
    WHERE ca.campaign_id = campaign_assets.campaign_id
      AND ca.influencer_id = auth.uid()
      AND ca.status = 'accepted'
  ));

-- ============================================================
-- 14. RPCs
-- ============================================================

-- Public feed with optional filters
CREATE OR REPLACE FUNCTION public.get_campaigns_public_feed(
  p_state text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_type text DEFAULT NULL
)
RETURNS TABLE(
  id uuid, title text, type text, region text, state text, city text,
  campaign_date date, apply_deadline date, brief_public text,
  requirements jsonb, status text, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.title, c.type, c.region, c.state, c.city,
         c.campaign_date, c.apply_deadline, c.brief_public,
         c.requirements, c.status, c.created_at
  FROM public.campaigns c
  WHERE c.status = 'active'
    AND (p_state IS NULL OR c.state = p_state)
    AND (p_city IS NULL OR c.city = p_city)
    AND (p_type IS NULL OR c.type = p_type)
  ORDER BY c.created_at DESC;
$$;

-- Full detail for accepted users or campaign owner
CREATE OR REPLACE FUNCTION public.get_campaign_detail_if_accepted(p_campaign_id uuid)
RETURNS TABLE(
  id uuid, title text, type text, region text, state text, city text,
  campaign_date date, apply_deadline date, brief_public text,
  brief_private text, requirements jsonb, status text, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.title, c.type, c.region, c.state, c.city,
         c.campaign_date, c.apply_deadline, c.brief_public, c.brief_private,
         c.requirements, c.status, c.created_at
  FROM public.campaigns c
  WHERE c.id = p_campaign_id
    AND (
      c.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.campaign_applications ca
        WHERE ca.campaign_id = c.id AND ca.influencer_id = auth.uid() AND ca.status = 'accepted'
      )
    );
$$;

-- Contractor's campaigns with applicant count
CREATE OR REPLACE FUNCTION public.get_my_campaigns()
RETURNS TABLE(
  id uuid, title text, type text, region text, state text, city text,
  campaign_date date, apply_deadline date, status text, created_at timestamptz,
  applicant_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.title, c.type, c.region, c.state, c.city,
         c.campaign_date, c.apply_deadline, c.status, c.created_at,
         (SELECT COUNT(*) FROM public.campaign_applications ca WHERE ca.campaign_id = c.id)
  FROM public.campaigns c
  WHERE c.created_by = auth.uid()
  ORDER BY c.created_at DESC;
$$;

-- Campaign applicants for contractor
CREATE OR REPLACE FUNCTION public.get_campaign_applicants(p_campaign_id uuid)
RETURNS TABLE(
  application_id uuid, influencer_id uuid, status text, note text,
  created_at timestamptz, influencer_name text, influencer_instagram text,
  influencer_city text, influencer_state text, influencer_followers text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ca.id, ca.influencer_id, ca.status, ca.note, ca.created_at,
         p.name, p.instagram, p.city, p.state, p.followers
  FROM public.campaign_applications ca
  JOIN public.profiles p ON p.id = ca.influencer_id
  JOIN public.campaigns c ON c.id = ca.campaign_id
  WHERE ca.campaign_id = p_campaign_id AND c.created_by = auth.uid();
$$;

-- Influencer applies to campaign
CREATE OR REPLACE FUNCTION public.apply_to_campaign(p_campaign_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'influencer') THEN
    RAISE EXCEPTION 'Only influencers can apply';
  END IF;
  IF NOT is_approved(auth.uid()) THEN
    RAISE EXCEPTION 'User not approved';
  END IF;
  INSERT INTO public.campaign_applications (campaign_id, influencer_id, status, note)
  VALUES (p_campaign_id, auth.uid(), 'pending', p_note)
  ON CONFLICT (campaign_id, influencer_id) DO NOTHING;
END;
$$;

-- Contractor accepts/rejects application
CREATE OR REPLACE FUNCTION public.contractor_decide_application(p_application_id uuid, p_decision text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_decision NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision: must be accepted or rejected';
  END IF;
  UPDATE public.campaign_applications
  SET status = p_decision, updated_at = now()
  WHERE id = p_application_id
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_applications.campaign_id AND c.created_by = auth.uid()
    );
END;
$$;

-- Recreate get_my_context (was dropped because it existed)
CREATE OR REPLACE FUNCTION public.get_my_context()
RETURNS TABLE(role text, approval_status text, profile_exists boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = auth.uid() LIMIT 1),
    (SELECT p.approval_status::text FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1),
    EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid());
$$;

-- ============================================================
-- 15. Storage bucket for campaign assets
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-assets', 'campaign-assets', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Contractors upload to campaign-assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'campaign-assets' AND has_role(auth.uid(), 'contractor') AND is_approved(auth.uid()));

CREATE POLICY "Auth users read campaign-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'campaign-assets' AND auth.uid() IS NOT NULL);

CREATE POLICY "Contractors delete from campaign-assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'campaign-assets' AND has_role(auth.uid(), 'contractor'));
