import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import { Zap, CheckCircle2, MapPin, Calendar, Loader2, Send, XCircle, Hourglass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { PublicCampaignFeed } from "@/types/database";

interface CampaignWithStatus extends PublicCampaignFeed {
  applicationStatus: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Zap }> = {
  available: { label: "Nova", color: "text-primary", icon: Zap },
  pending: { label: "Aguardando", color: "text-warning", icon: Hourglass },
  accepted: { label: "Aprovada", color: "text-accent", icon: CheckCircle2 },
  rejected: { label: "Não selecionada", color: "text-muted-foreground", icon: XCircle },
};

const InfluencerDashboard = () => {
  const navigate = useNavigate();
  const { user, approvalStatus } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "available" | "pending" | "accepted">("all");
  const isPending = approvalStatus === "pending";

  // ✅ Formata datas para pt-BR (DD/MM/AAAA) sem bug de fuso em YYYY-MM-DD
  const formatDateBR = (value?: string | null) => {
    if (!value) return "-";

    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const d = isDateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);

    if (Number.isNaN(d.getTime())) return "-";

    return isDateOnly ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : d.toLocaleDateString("pt-BR");
  };

  // ✅ true se apply_deadline < hoje (em UTC, por ser DATE no banco)
  const isExpired = (applyDeadline?: string | null) => {
    if (!applyDeadline) return false;

    // date-only vindo do Supabase geralmente vira "YYYY-MM-DD"
    if (!/^\d{4}-\d{2}-\d{2}$/.test(applyDeadline)) return false;

    const deadlineUTC = new Date(`${applyDeadline}T00:00:00Z`);
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    return deadlineUTC < todayUTC;
  };

  const fetchData = useCallback(async () => {
    if (!user) return;

    const [campaignsRes, appsRes] = await Promise.all([
      supabase.rpc("get_campaigns_public_feed" as any),
      supabase.from("campaign_applications").select("campaign_id, status").eq("influencer_id", user.id),
    ]);

    if (campaignsRes.error) {
      console.error("Error fetching campaigns:", campaignsRes.error);
      setIsLoading(false);
      return;
    }

    const appMap = new Map<string, string>();
    ((appsRes.data || []) as any[]).forEach((a: any) => appMap.set(a.campaign_id, a.status));

    const withStatus: CampaignWithStatus[] = ((campaignsRes.data || []) as unknown as PublicCampaignFeed[])
      .map((c) => ({
        ...c,
        applicationStatus: appMap.get(c.id) || "available",
      }))
      // ✅ defensivo: se por algum motivo vier vencida, remove do feed
      .filter((c) => !isExpired((c as any).apply_deadline ?? null));

    setCampaigns(withStatus);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApply = async (campaignId: string) => {
    if (!user?.id) {
      toast.error("Faça login novamente.");
      return;
    }
    if (isPending) {
      toast.error("Seu perfil ainda está em análise. Aguarde aprovação.");
      return;
    }

    const selected = campaigns.find((c) => c.id === campaignId) as any;
    const deadline = selected?.apply_deadline ?? null;

    if (deadline && isExpired(deadline)) {
      toast.error("Prazo de candidatura encerrado.");
      return;
    }

    setApplyingTo(campaignId);

    const { error } = await supabase.rpc("apply_to_campaign" as any, {
      p_campaign_id: campaignId,
      // p_note é opcional e tem DEFAULT no SQL, então não precisa enviar
    });

    if (error) {
      console.error("Error applying:", error);
      const msg = error.message || "Erro ao se candidatar.";

      const lower = msg.toLowerCase();
      if (lower.includes("deadline passed")) {
        toast.error("Prazo de candidatura encerrado.");
      } else if (lower.includes("user not approved") || lower.includes("not approved")) {
        toast.error("Seu perfil ainda está em análise. Aguarde aprovação.");
      } else if (lower.includes("only influencers")) {
        toast.error("Apenas influenciadoras podem se candidatar.");
      } else {
        toast.error(msg);
      }

      setApplyingTo(null);
      return;
    }

    toast.success("Candidatura enviada!");
    setApplyingTo(null);
    await fetchData();
  };

  const filtered = filter === "all" ? campaigns : campaigns.filter((c) => c.applicationStatus === filter);
  const newCount = campaigns.filter((c) => c.applicationStatus === "available").length;
  const pendingCount = campaigns.filter((c) => c.applicationStatus === "pending").length;
  const acceptedCount = campaigns.filter((c) => c.applicationStatus === "accepted").length;

  return (
    <MobileLayout title="Campanhas" navType="influencer">
      <div className="px-6 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-muted-foreground text-xs uppercase tracking-widest mb-1">Painel da influenciadora</p>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Campanhas na sua <span className="text-gradient-neon">região</span>
          </h2>
        </motion.div>

        {isPending && (
          <div className="glass-card p-4 flex items-start gap-3 border border-warning/30">
            <Hourglass className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Seu perfil está sendo analisado</p>
              <p className="text-xs text-muted-foreground mt-1">Aguarde a aprovação para se candidatar às campanhas.</p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-3 gap-3">
              <div className="glass-card p-4 flex flex-col items-center text-center gap-1">
                <Zap className="w-5 h-5 text-primary" />
                <span className="font-display font-bold text-xl text-foreground">{newCount}</span>
                <span className="text-[10px] text-muted-foreground">Novas</span>
              </div>
              <div className="glass-card p-4 flex flex-col items-center text-center gap-1">
                <Hourglass className="w-5 h-5 text-warning" />
                <span className="font-display font-bold text-xl text-foreground">{pendingCount}</span>
                <span className="text-[10px] text-muted-foreground">Pendentes</span>
              </div>
              <div className="glass-card p-4 flex flex-col items-center text-center gap-1">
                <CheckCircle2 className="w-5 h-5 text-accent" />
                <span className="font-display font-bold text-xl text-foreground">{acceptedCount}</span>
                <span className="text-[10px] text-muted-foreground">Aprovadas</span>
              </div>
            </motion.div>

            {/* Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {[
                { key: "all" as const, label: "Todas" },
                { key: "available" as const, label: "Novas" },
                { key: "pending" as const, label: "Pendentes" },
                { key: "accepted" as const, label: "Aprovadas" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                    filter === f.key ? "bg-primary/10 text-primary border border-primary/30" : "bg-card text-muted-foreground border border-border/50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Campaigns */}
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="py-12 text-center">
                  <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma campanha disponível no momento.</p>
                </div>
              ) : (
                filtered.map((campaign, i) => {
                  const statusKey = campaign.applicationStatus;
                  const status = statusConfig[statusKey] || statusConfig.available;
                  const isApplying = applyingTo === campaign.id;

                  // defensivo: se por alguma razão existir apply_deadline e estiver expirado, trava o botão
                  const deadline = (campaign as any).apply_deadline as string | undefined;
                  const expired = !!deadline && isExpired(deadline);

                  return (
                    <motion.div
                      key={campaign.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.08 }}
                      className="glass-card-hover p-5"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0 mr-2">
                          <h4 className="font-semibold text-foreground text-sm">{campaign.title}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5 capitalize">{campaign.type}</p>
                        </div>
                        <div className={`flex items-center gap-1 shrink-0 ${status.color}`}>
                          <status.icon className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">{status.label}</span>
                        </div>
                      </div>

                      <p className="text-xs text-foreground/60 mb-3 line-clamp-2">{campaign.brief_public}</p>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {campaign.city}, {campaign.state}
                        </span>
                        {campaign.campaign_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDateBR(campaign.campaign_date)}
                          </span>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t border-border/30">
                        {statusKey === "available" && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => navigate(`/campanha/${campaign.id}`)}
                              className="flex-1 py-2.5 rounded-xl border border-border/50 text-muted-foreground font-medium text-xs"
                            >
                              Ver detalhes
                            </button>
                            <button
                              onClick={() => handleApply(campaign.id)}
                              disabled={isApplying || expired}
                              className="flex-[2] py-2.5 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-xs glow-blue flex items-center justify-center gap-1.5 disabled:opacity-60"
                            >
                              {isApplying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                              {isApplying ? "Enviando..." : expired ? "Prazo encerrado" : "Candidatar-se"}
                            </button>
                          </div>
                        )}

                        {statusKey === "pending" && (
                          <div className="flex items-center justify-center gap-2 py-2 text-warning">
                            <Hourglass className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">Aguardando aprovação</span>
                          </div>
                        )}

                        {statusKey === "accepted" && (
                          <button
                            onClick={() => navigate(`/campanha-detalhe/${campaign.id}`)}
                            className="w-full py-2.5 rounded-xl border border-accent/30 bg-accent/5 text-accent font-semibold text-xs flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Ver detalhes completos
                          </button>
                        )}

                        {statusKey === "rejected" && (
                          <div className="flex items-center justify-center gap-2 py-2 text-muted-foreground">
                            <XCircle className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">Não selecionada</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </MobileLayout>
  );
};

export default InfluencerDashboard;