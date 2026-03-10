// src/services/campaignInviteEmails.ts
import { supabase } from "@/integrations/supabase/client";

export type SendCampaignInviteEmailsResult = {
  ok: boolean;
  sent: number;
  skipped: number;
  failed: number;
  errors?: Array<{
    notificationId: string;
    userId: string;
    message: string;
  }>;
  message?: string;
};

export async function sendCampaignInviteEmails(
  campaignId: string
): Promise<SendCampaignInviteEmailsResult> {
  const safeCampaignId = String(campaignId || "").trim();

  if (!safeCampaignId) {
    throw new Error("campaignId é obrigatório.");
  }

  const { data, error } = await supabase.functions.invoke(
    "send-campaign-invite-email",
    {
      body: {
        campaignId: safeCampaignId,
      },
    }
  );

  if (error) {
    throw error;
  }

  return (data || {
    ok: false,
    sent: 0,
    skipped: 0,
    failed: 0,
    message: "Resposta inválida da função de e-mail.",
  }) as SendCampaignInviteEmailsResult;
}