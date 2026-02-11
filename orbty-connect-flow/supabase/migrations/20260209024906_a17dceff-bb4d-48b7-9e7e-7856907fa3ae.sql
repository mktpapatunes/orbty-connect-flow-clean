
-- =============================================
-- ORBTY Database Schema
-- =============================================

-- 1. Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'contractor', 'influencer');

-- 2. Create enum for approval status
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

-- 3. Create enum for campaign status
CREATE TYPE public.campaign_status AS ENUM ('active', 'pending', 'completed', 'cancelled');

-- 4. Create enum for assignment status
CREATE TYPE public.assignment_status AS ENUM ('pending', 'accepted', 'rejected');

-- =============================================
-- TABLES
-- =============================================

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  instagram TEXT,
  followers TEXT,
  invite_code TEXT,
  has_invite_code BOOLEAN NOT NULL DEFAULT false,
  approval_status public.approval_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Invite codes table
CREATE TABLE public.invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Campaigns table
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  brand TEXT NOT NULL,
  region TEXT NOT NULL,
  campaign_date TEXT,
  value TEXT NOT NULL,
  posts TEXT NOT NULL,
  briefing TEXT,
  material TEXT,
  link TEXT,
  status public.campaign_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Campaign assignments
CREATE TABLE public.campaign_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  influencer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.assignment_status NOT NULL DEFAULT 'pending',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, influencer_id)
);

-- =============================================
-- ENABLE RLS
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_assignments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- =============================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Check if user is approved
CREATE OR REPLACE FUNCTION public.is_approved(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND approval_status = 'approved'
  )
$$;

-- =============================================
-- RLS POLICIES - PROFILES
-- =============================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can insert their own profile (during registration)
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- Admins can update any profile (for approval/rejection)
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES - USER ROLES
-- =============================================

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can manage roles
CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow self-role assignment during registration (handled by trigger)
CREATE POLICY "Users can insert own role during registration"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES - INVITE CODES
-- =============================================

-- Anyone authenticated can read invite codes (to validate during registration)
CREATE POLICY "Authenticated users can read invite codes"
  ON public.invite_codes FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage invite codes
CREATE POLICY "Admins can manage invite codes"
  ON public.invite_codes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES - CAMPAIGNS
-- =============================================

-- Admins can see all campaigns
CREATE POLICY "Admins can view all campaigns"
  ON public.campaigns FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Contractors can see their own campaigns
CREATE POLICY "Contractors can view own campaigns"
  ON public.campaigns FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() AND public.has_role(auth.uid(), 'contractor'));

-- Approved influencers can see active campaigns
CREATE POLICY "Influencers can view active campaigns"
  ON public.campaigns FOR SELECT
  TO authenticated
  USING (
    status = 'active'
    AND public.has_role(auth.uid(), 'influencer')
    AND public.is_approved(auth.uid())
  );

-- Approved contractors can create campaigns
CREATE POLICY "Approved contractors can create campaigns"
  ON public.campaigns FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.has_role(auth.uid(), 'contractor')
    AND public.is_approved(auth.uid())
  );

-- Contractors can update their own campaigns
CREATE POLICY "Contractors can update own campaigns"
  ON public.campaigns FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND public.has_role(auth.uid(), 'contractor')
  );

-- Admins can update any campaign
CREATE POLICY "Admins can update any campaign"
  ON public.campaigns FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES - CAMPAIGN ASSIGNMENTS
-- =============================================

-- Admins can see all assignments
CREATE POLICY "Admins can view all assignments"
  ON public.campaign_assignments FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Influencers can see their own assignments
CREATE POLICY "Influencers can view own assignments"
  ON public.campaign_assignments FOR SELECT
  TO authenticated
  USING (influencer_id = auth.uid());

-- Contractors can see assignments for their campaigns
CREATE POLICY "Contractors can view own campaign assignments"
  ON public.campaign_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_id
      AND campaigns.created_by = auth.uid()
    )
  );

-- Approved influencers can create assignments (accept campaigns)
CREATE POLICY "Influencers can create assignments"
  ON public.campaign_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    influencer_id = auth.uid()
    AND public.has_role(auth.uid(), 'influencer')
    AND public.is_approved(auth.uid())
  );

-- Influencers can update their own assignment status
CREATE POLICY "Influencers can update own assignments"
  ON public.campaign_assignments FOR UPDATE
  TO authenticated
  USING (influencer_id = auth.uid());

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_campaign_assignments_updated_at
  BEFORE UPDATE ON public.campaign_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- SEED DATA - INVITE CODES
-- =============================================

INSERT INTO public.invite_codes (code) VALUES
  ('ORBTY2026'),
  ('VIP-ORBTY'),
  ('INFLUENCER-PRO'),
  ('CONVITE2026');

-- =============================================
-- STORAGE BUCKET FOR CAMPAIGN MEDIA
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-media', 'campaign-media', true);

-- Storage policies
CREATE POLICY "Anyone can view campaign media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'campaign-media');

CREATE POLICY "Authenticated users can upload campaign media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'campaign-media');

CREATE POLICY "Users can update own campaign media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'campaign-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own campaign media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'campaign-media' AND auth.uid()::text = (storage.foldername(name))[1]);
