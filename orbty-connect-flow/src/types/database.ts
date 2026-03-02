// Manual type definitions for ORBTY database tables

export type AppRole = "admin" | "contractor" | "influencer";
export type ApprovalStatus = "pending" | "approved" | "rejected";

/* =========================
   PROFILES / ROLES
========================= */

export interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string;

  city: string | null;
  state: string | null;
  neighborhood?: string | null;

  instagram: string | null;
  followers: string | null;

  invite_code: string | null;
  has_invite_code: boolean;

  desired_role?: AppRole | null;
  approval_status: ApprovalStatus;

  content_style?: string | null;
  bio?: string | null;
  avatar_url?: string | null;

  created_at: string;
  updated_at: string;
}

export interface UserRoleRow {
  id: string;
  user_id: string;
  role: AppRole;
}

/* =========================
   CAMPAIGNS (DB)
========================= */

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

/* =========================
   RPC return types
========================= */

export interface CreatorSuggestion {
  id: string;
  name: string | null;
  city: string | null;
  state: string | null;
  neighborhood?: string | null;
  followers: string | null;
  content_style?: string | null;

  // opcionais (se sua RPC também retornar)
  approval_status?: ApprovalStatus | null;
  desired_role?: AppRole | null;
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

/* =========================
   CREATE CAMPAIGN (FORM STATE)
   (usado no CampaignContext / CreateCampaign)
========================= */

export type CampaignType = "event" | "music" | "product" | "";

/**
 * Estado do formulário (não é a tabela campaigns).
 * Você usa esses campos no CreateCampaign.tsx via `data as any`.
 * Agora dá pra tipar e remover vários `as any`.
 */
export interface CreateCampaignFormData {
  // Step 1
  title: string;
  campaignType: CampaignType;

  // localização escolhida (Nominatim)
  selectedCity: string;
  selectedState: string;
  region: string;

  // período (no seu código: campaignDate = início, applyDeadline = fim)
  campaignDate: string; // YYYY-MM-DD
  applyDeadline: string; // YYYY-MM-DD

  // objetivos (você armazena no briefPublic como CSV)
  briefPublic: string;

  // Step 2
  contentSegments: string; // CSV (até 3)
  creatorsNeeded: number; // 1..50
  selectedCreatorIds: string[];

  briefPrivate: string;

  // Requisitos extras
  posts?: number;
  format?: string; // ex: "stories" | "reels" etc (deixa aberto)
  hashtags?: string; // CSV
  mentions?: string; // CSV
}

/* =========================
   CREATE CAMPAIGN RPC PAYLOAD
========================= */

export type CreateCampaignRequirements = {
  posts: number;
  format: string;
  hashtags: string[];
  mentions: string[];
  creators_needed: number;
  content_segments: string[]; // array (já sai do selectedSegments)
  selected_creator_ids: string[]; // array
};

export type CreateCampaignPayload = {
  title: string;
  type: string;
  region: string;
  state: string;
  city: string;
  campaign_date: string | null;
  apply_deadline: string;
  brief_public: string;
  brief_private: string | null;
  requirements: CreateCampaignRequirements;
};