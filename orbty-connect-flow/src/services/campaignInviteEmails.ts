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

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error("Sessão inválida. Faça login novamente.");
  }

  const { data, error } = await supabase.functions.invoke(
    "send-campaign-invite-email",
    {
      body: {
        campaignId: safeCampaignId,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
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