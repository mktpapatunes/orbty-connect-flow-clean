// supabase/functions/send-campaign-invite-email/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { Resend } from "npm:resend@4.0.0";

type NotificationRow = {
  id: string;
  user_id: string;
  metadata: Record<string, any> | null;
};

type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function escapeHtml(input: string) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildInviteEmailHtml(params: {
  creatorName: string;
  contractorName: string;
  campaignTitle: string;
  campaignUrl: string;
}) {
  const creatorName = escapeHtml(params.creatorName);
  const contractorName = escapeHtml(params.contractorName);
  const campaignTitle = escapeHtml(params.campaignTitle);
  const campaignUrl = escapeHtml(params.campaignUrl);

  return `
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Você foi selecionado para uma campanha</title>
  </head>
  <body style="margin:0;padding:0;background:#0b1020;font-family:Arial,Helvetica,sans-serif;color:#e5e7eb;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b1020;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#111827;border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 16px 32px;background:linear-gradient(135deg,#111827 0%,#0f172a 100%);">
                <div style="display:inline-block;padding:8px 12px;border-radius:999px;background:rgba(59,130,246,0.12);color:#60a5fa;font-size:12px;font-weight:700;letter-spacing:.04em;">
                  ORBTY CREATORS
                </div>
                <h1 style="margin:18px 0 0 0;font-size:28px;line-height:1.2;color:#ffffff;">
                  Você foi selecionado para uma campanha 🚀
                </h1>
                <p style="margin:14px 0 0 0;font-size:15px;line-height:1.7;color:#cbd5e1;">
                  Olá, <strong style="color:#ffffff;">${creatorName}</strong>.
                </p>
                <p style="margin:12px 0 0 0;font-size:15px;line-height:1.7;color:#cbd5e1;">
                  A marca <strong style="color:#ffffff;">${contractorName}</strong> selecionou você para a campanha:
                </p>
                <p style="margin:14px 0 0 0;font-size:20px;line-height:1.5;color:#93c5fd;font-weight:700;">
                  ${campaignTitle}
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:8px 32px 0 32px;">
                <div style="padding:18px 18px;border-radius:18px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);">
                  <p style="margin:0;font-size:14px;line-height:1.7;color:#cbd5e1;">
                    Clique no botão abaixo para ver os detalhes da campanha e confirmar sua participação.
                  </p>
                </div>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:28px 32px 10px 32px;">
                <a
                  href="${campaignUrl}"
                  style="display:inline-block;padding:14px 24px;border-radius:16px;background:linear-gradient(135deg,#3b82f6 0%,#6366f1 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;"
                >
                  Ver campanha
                </a>
              </td>
            </tr>

            <tr>
              <td style="padding:8px 32px 0 32px;">
                <p style="margin:0;font-size:12px;line-height:1.7;color:#94a3b8;text-align:center;">
                  Se o botão não abrir, copie e cole este link no navegador:
                </p>
                <p style="margin:8px 0 0 0;font-size:12px;line-height:1.7;color:#93c5fd;word-break:break-all;text-align:center;">
                  ${campaignUrl}
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 32px 32px 32px;">
                <div style="height:1px;background:rgba(255,255,255,0.08);margin-bottom:18px;"></div>
                <p style="margin:0;font-size:12px;line-height:1.7;color:#94a3b8;text-align:center;">
                  Equipe Orbty Creators
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, {
      ok: false,
      message: "Method not allowed",
    });
  }

  try {
    const projectUrl = Deno.env.get("PROJECT_URL");
    const anonKey = Deno.env.get("ANON_KEY");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const emailFrom = Deno.env.get("EMAIL_FROM");
    const appBaseUrl = Deno.env.get("APP_BASE_URL");

    if (
      !projectUrl ||
      !anonKey ||
      !serviceRoleKey ||
      !resendApiKey ||
      !emailFrom ||
      !appBaseUrl
    ) {
      return jsonResponse(500, {
        ok: false,
        message: "Missing required environment variables",
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, {
        ok: false,
        message: "Missing Authorization header",
      });
    }

    const body = await req.json().catch(() => null);
    const campaignId = String(body?.campaignId || "").trim();

    if (!campaignId) {
      return jsonResponse(400, {
        ok: false,
        message: "campaignId is required",
      });
    }

    const authClient = createClient(projectUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse(401, {
        ok: false,
        message: "Unauthorized",
      });
    }

    const admin = createClient(projectUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .select("id, title, created_by")
      .eq("id", campaignId)
      .eq("created_by", user.id)
      .maybeSingle();

    if (campaignError) {
      console.error("LOAD_CAMPAIGN_ERROR", campaignError);
      return jsonResponse(500, {
        ok: false,
        message: "Failed to load campaign",
      });
    }

    if (!campaign) {
      return jsonResponse(403, {
        ok: false,
        message: "Campaign not found or access denied",
      });
    }

    const { data: organization } = await admin
      .from("organizations")
      .select("name")
      .eq("created_by", user.id)
      .maybeSingle();

    const { data: contractorProfile } = await admin
      .from("profiles")
      .select("name, company_name")
      .eq("id", user.id)
      .maybeSingle();

    const contractorName =
      String(organization?.name || "").trim() ||
      String(contractorProfile?.company_name || "").trim() ||
      String(contractorProfile?.name || "").trim() ||
      "Marca";

    const { data: participants, error: participantsError } = await admin
      .from("campaign_participants")
      .select("influencer_id, status")
      .eq("campaign_id", campaignId)
      .eq("status", "invited");

    if (participantsError) {
      console.error("LOAD_PARTICIPANTS_ERROR", participantsError);
      return jsonResponse(500, {
        ok: false,
        message: "Failed to load participants",
      });
    }

    const influencerIds = Array.from(
      new Set(
        (participants || [])
          .map((row: any) => String(row.influencer_id || "").trim())
          .filter(Boolean)
      )
    );

    if (influencerIds.length === 0) {
      return jsonResponse(200, {
        ok: true,
        sent: 0,
        skipped: 0,
        failed: 0,
        message: "No invited influencers found",
      });
    }

    const { data: notifications, error: notificationsError } = await admin
      .from("notifications")
      .select("id, user_id, metadata")
      .eq("type", "campaign_invited")
      .in("user_id", influencerIds);

    if (notificationsError) {
      console.error("LOAD_NOTIFICATIONS_ERROR", notificationsError);
      return jsonResponse(500, {
        ok: false,
        message: "Failed to load notifications",
      });
    }

    const campaignNotifications = ((notifications || []) as NotificationRow[]).filter(
      (row) => String(row.metadata?.campaign_id || "") === campaignId
    );

    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, name, email")
      .in("id", influencerIds);

    if (profilesError) {
      console.error("LOAD_PROFILES_ERROR", profilesError);
      return jsonResponse(500, {
        ok: false,
        message: "Failed to load influencer profiles",
      });
    }

    const profileMap = new Map<string, ProfileRow>();
    for (const profile of (profiles || []) as ProfileRow[]) {
      profileMap.set(String(profile.id), profile);
    }

    const resend = new Resend(resendApiKey);

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ notificationId: string; userId: string; message: string }> = [];

    for (const notification of campaignNotifications) {
      const metadata = notification.metadata || {};
      const alreadySentAt = String(metadata.email_sent_at || "").trim();

      if (alreadySentAt) {
        skipped += 1;
        continue;
      }

      const profile = profileMap.get(String(notification.user_id));
      const email = String(profile?.email || "").trim();
      const creatorName = String(profile?.name || "").trim() || "Creator";

      if (!email) {
        failed += 1;

        await admin
          .from("notifications")
          .update({
            metadata: {
              ...metadata,
              email_error: "Missing recipient email",
              email_error_at: new Date().toISOString(),
            },
          })
          .eq("id", notification.id);

        errors.push({
          notificationId: notification.id,
          userId: notification.user_id,
          message: "Missing recipient email",
        });
        continue;
      }

      const campaignUrl = `${appBaseUrl}/campanha/${campaignId}`;

      try {
        const emailResult = await resend.emails.send({
          from: emailFrom,
          to: [email],
          subject: "Você foi selecionado para uma campanha 🚀",
          html: buildInviteEmailHtml({
            creatorName,
            contractorName,
            campaignTitle: String(campaign.title || "Campanha"),
            campaignUrl,
          }),
        });

        if ((emailResult as any)?.error) {
          throw new Error((emailResult as any).error.message || "Resend error");
        }

        await admin
          .from("notifications")
          .update({
            metadata: {
              ...metadata,
              email_sent_at: new Date().toISOString(),
              email_to: email,
              email_provider: "resend",
              email_provider_id: (emailResult as any)?.data?.id || null,
            },
          })
          .eq("id", notification.id);

        sent += 1;
      } catch (error: any) {
        failed += 1;

        await admin
          .from("notifications")
          .update({
            metadata: {
              ...metadata,
              email_error: String(error?.message || "Unknown email error"),
              email_error_at: new Date().toISOString(),
            },
          })
          .eq("id", notification.id);

        errors.push({
          notificationId: notification.id,
          userId: notification.user_id,
          message: String(error?.message || "Unknown email error"),
        });
      }
    }

    return jsonResponse(200, {
      ok: true,
      sent,
      skipped,
      failed,
      errors,
    });
  } catch (error: any) {
    console.error("SEND_CAMPAIGN_INVITE_EMAIL_UNEXPECTED_ERROR", error);

    return jsonResponse(500, {
      ok: false,
      message: String(error?.message || "Unexpected error"),
    });
  }
});