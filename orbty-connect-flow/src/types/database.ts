// Manual type definitions for ORBTY database tables

export type AppRole = 'admin' | 'contractor' | 'influencer';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  instagram: string | null;
  followers: string | null;
  invite_code: string | null;
  has_invite_code: boolean;
  approval_status: ApprovalStatus;
  created_at: string;
  updated_at: string;
}

export interface UserRoleRow {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface Campaign {
  id: string;
  created_by: string;
  title: string;
  type: string;
  region: string;
  state: string;
  city: string;
  campaign_date: string | null;
  apply_deadline: string;
  brief_public: string;
  brief_private: string | null;
  requirements: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignAsset {
  id: string;
  campaign_id: string;
  path: string;
  label: string | null;
  mime: string | null;
  size: number | null;
  created_at: string;
}

export interface CampaignApplication {
  id: string;
  campaign_id: string;
  influencer_id: string;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface InviteCode {
  id: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

// RPC return types
export interface PublicCampaignFeed {
  id: string;
  title: string;
  type: string;
  region: string;
  state: string;
  city: string;
  campaign_date: string | null;
  apply_deadline: string;
  brief_public: string;
  requirements: Record<string, unknown>;
  status: string;
  created_at: string;
}

export interface MyCampaign {
  id: string;
  title: string;
  type: string;
  region: string;
  state: string;
  city: string;
  campaign_date: string | null;
  apply_deadline: string;
  status: string;
  created_at: string;
  applicant_count: number;
}

export interface CampaignApplicant {
  application_id: string;
  influencer_id: string;
  status: string;
  note: string | null;
  created_at: string;
  influencer_name: string;
  influencer_instagram: string | null;
  influencer_city: string;
  influencer_state: string;
  influencer_followers: string | null;
}
