
-- 1. Make campaign-media bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'campaign-media';

-- 2. Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view campaign media" ON storage.objects;

-- 3. Create a restricted SELECT policy for authenticated users only
CREATE POLICY "Authenticated users can view campaign media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'campaign-media' AND (
      -- Users can view their own uploads
      auth.uid()::text = (storage.foldername(name))[1]
      OR
      -- Admins can view all
      public.has_role(auth.uid(), 'admin'::app_role)
      OR
      -- Approved contractors can view files in their campaign folders
      EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id::text = (storage.foldername(name))[1]
        AND c.created_by = auth.uid()
      )
      OR
      -- Approved influencers assigned to the campaign can view its files
      EXISTS (
        SELECT 1 FROM public.campaign_assignments ca
        JOIN public.campaigns c ON c.id = ca.campaign_id
        WHERE c.id::text = (storage.foldername(name))[1]
        AND ca.influencer_id = auth.uid()
        AND ca.status = 'accepted'
      )
    )
  );
