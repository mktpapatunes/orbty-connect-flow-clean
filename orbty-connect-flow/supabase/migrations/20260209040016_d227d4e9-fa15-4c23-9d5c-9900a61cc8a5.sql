ALTER TABLE public.campaign_assignments REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_assignments;