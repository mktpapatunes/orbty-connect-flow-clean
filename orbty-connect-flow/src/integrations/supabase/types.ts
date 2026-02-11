export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      campaign_applications: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          influencer_id: string
          note: string | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          influencer_id: string
          note?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          influencer_id?: string
          note?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_applications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_assets: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          label: string | null
          mime: string | null
          path: string
          size: number | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          label?: string | null
          mime?: string | null
          path: string
          size?: number | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          label?: string | null
          mime?: string | null
          path?: string
          size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_assets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          apply_deadline: string
          brief_private: string | null
          brief_public: string
          campaign_date: string | null
          city: string
          created_at: string
          created_by: string
          id: string
          region: string
          requirements: Json
          state: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          apply_deadline?: string
          brief_private?: string | null
          brief_public?: string
          campaign_date?: string | null
          city?: string
          created_at?: string
          created_by: string
          id?: string
          region: string
          requirements?: Json
          state?: string
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          apply_deadline?: string
          brief_private?: string | null
          brief_public?: string
          campaign_date?: string | null
          city?: string
          created_at?: string
          created_by?: string
          id?: string
          region?: string
          requirements?: Json
          state?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          approval_status: Database["public"]["Enums"]["approval_status"]
          audience_gender: Json | null
          avatar_url: string | null
          bio: string | null
          city: string
          content_style: string | null
          created_at: string
          desired_role: Database["public"]["Enums"]["app_role"] | null
          email: string
          followers: string | null
          gender: string | null
          has_invite_code: boolean
          id: string
          instagram: string | null
          invite_code: string | null
          name: string
          neighborhood: string | null
          phone: string
          state: string
          updated_at: string
        }
        Insert: {
          age?: number | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          audience_gender?: Json | null
          avatar_url?: string | null
          bio?: string | null
          city: string
          content_style?: string | null
          created_at?: string
          desired_role?: Database["public"]["Enums"]["app_role"] | null
          email: string
          followers?: string | null
          gender?: string | null
          has_invite_code?: boolean
          id: string
          instagram?: string | null
          invite_code?: string | null
          name: string
          neighborhood?: string | null
          phone: string
          state: string
          updated_at?: string
        }
        Update: {
          age?: number | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          audience_gender?: Json | null
          avatar_url?: string | null
          bio?: string | null
          city?: string
          content_style?: string | null
          created_at?: string
          desired_role?: Database["public"]["Enums"]["app_role"] | null
          email?: string
          followers?: string | null
          gender?: string | null
          has_invite_code?: boolean
          id?: string
          instagram?: string | null
          invite_code?: string | null
          name?: string
          neighborhood?: string | null
          phone?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_approve_user: { Args: { p_user_id: string }; Returns: undefined }
      admin_create_invite_code: { Args: { p_code: string }; Returns: undefined }
      admin_list_invite_codes: {
        Args: never
        Returns: {
          code: string
          created_at: string
          id: string
          is_active: boolean
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          approval_status: string
          city: string
          created_at: string
          email: string
          followers: string
          has_invite_code: boolean
          id: string
          instagram: string
          invite_code: string
          name: string
          phone: string
          role: string
          state: string
          updated_at: string
        }[]
      }
      admin_reject_user: { Args: { p_user_id: string }; Returns: undefined }
      admin_set_user_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: undefined
      }
      admin_toggle_invite_code: {
        Args: { p_active: boolean; p_code_id: string }
        Returns: undefined
      }
      apply_to_campaign: {
        Args: { p_campaign_id: string; p_note?: string }
        Returns: undefined
      }
      assign_registration_role: { Args: { _role: string }; Returns: undefined }
      contractor_decide_application: {
        Args: { p_application_id: string; p_decision: string }
        Returns: undefined
      }
      create_campaign: { Args: { payload: Json }; Returns: string }
      get_campaign_applicants: {
        Args: { p_campaign_id: string }
        Returns: {
          application_id: string
          created_at: string
          influencer_city: string
          influencer_followers: string
          influencer_id: string
          influencer_instagram: string
          influencer_name: string
          influencer_state: string
          note: string
          status: string
        }[]
      }
      get_campaign_detail_if_accepted: {
        Args: { p_campaign_id: string }
        Returns: {
          apply_deadline: string
          brief_private: string
          brief_public: string
          campaign_date: string
          city: string
          created_at: string
          id: string
          region: string
          requirements: Json
          state: string
          status: string
          title: string
          type: string
        }[]
      }
      get_campaigns_public_feed: {
        Args: { p_city?: string; p_state?: string; p_type?: string }
        Returns: {
          apply_deadline: string
          brief_public: string
          campaign_date: string
          city: string
          created_at: string
          id: string
          region: string
          requirements: Json
          state: string
          status: string
          title: string
          type: string
        }[]
      }
      get_my_campaigns: {
        Args: never
        Returns: {
          applicant_count: number
          apply_deadline: string
          campaign_date: string
          city: string
          created_at: string
          id: string
          region: string
          state: string
          status: string
          title: string
          type: string
        }[]
      }
      get_my_context: {
        Args: never
        Returns: {
          approval_status: string
          profile_exists: boolean
          role: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      update_my_profile: {
        Args: {
          p_age?: number
          p_audience_gender?: Json
          p_avatar_url?: string
          p_bio?: string
          p_content_style?: string
          p_gender?: string
          p_name?: string
          p_neighborhood?: string
        }
        Returns: undefined
      }
      validate_invite_code: { Args: { _code: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "contractor" | "influencer"
      approval_status: "pending" | "approved" | "rejected"
      assignment_status: "pending" | "accepted" | "rejected"
      campaign_status: "active" | "pending" | "completed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "contractor", "influencer"],
      approval_status: ["pending", "approved", "rejected"],
      assignment_status: ["pending", "accepted", "rejected"],
      campaign_status: ["active", "pending", "completed", "cancelled"],
    },
  },
} as const
