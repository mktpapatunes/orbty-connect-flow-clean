import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import {
  Plus,
  Clock,
  User,
  Zap,
  TrendingUp,
  Users,
  ArrowRight,
  Sparkles,
  Loader2,
  Calendar,
  BadgeCheck,
  Flame,
  Trash2,
  Ban,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { MyCampaign } from "@/types/database";

type Bucket =
  | "active"
  | "closed_expired"
  | "closed_manual"
  | "completed"
  | "draft"
  | "deleted"
  | "all";

type MyCampaignRow = MyCampaign & {
  campaign_date?: string | null;
  apply_deadline?: string | null;
  created_at?: string | null;
  applicant_count?: number;
  bucket?: Bucket | string;
};

const ContractorDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<MyCampaignRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bucket, setBucket] = useState<Bucket>("active");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const formatDateBR = (value?: string | null) => {
    if (!value) return "-";
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const d = isDateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return isDateOnly ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : d.toLocaleDateString("pt-BR");
  };

  const daysLeftUTC = (applyDeadline?: string | null) => {
    if (!applyDeadline) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(applyDeadline)) return null;

    const deadlineUTC = new Date(`${applyDeadline}T00:00:00Z`);
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const diffMs = deadlineUTC.getTime() - todayUTC.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  const getUrgencyLabel = (daysLeft: number) => {
    if (daysLeft <= 0) return "Termina hoje";
    if (daysLeft === 1) return "Termina amanhã";
    return `Faltam ${daysLeft} dias`;
  };

  const fetchCampaigns = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    const { data, error } = await supabase.rpc("get_my_campaigns" as any, { p_bucket: "all" });

    if (!error && data) {
      setCampaigns(data as unknown as MyCampaignRow[]);
    } else if (error) {
      console.error("GET_MY_CAMPAIGNS_ERROR", error);
      toast.error("Erro ao carregar campanhas.");
    }

    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const groups = useMemo(() => {
    const active = campaigns.filter((c) => c.bucket === "active");
    const expired = campaigns.filter((c) => c.bucket === "closed_expired");
    const closedManual = campaigns.filter((c) => c.bucket === "closed_manual");
    const completed = campaigns.filter((c) => c.bucket === "completed");
    const draft = campaigns.filter((c) => c.bucket === "draft");
    const deleted = campaigns.filter((c) => c.bucket === "deleted");
    return { active, expired, closedManual, completed, draft, deleted };
  }, [campaigns]);

  const list = useMemo(() => {
    if (bucket === "active") return groups.active;
    if (bucket === "closed_expired") return groups.expired;
    if (bucket === "closed_manual") return groups.closedManual;
    if (bucket === "completed") return groups.completed;
    if (bucket === "draft") return groups.draft;
    if (bucket === "deleted") return groups.deleted;
    return campaigns;
  }, [bucket, campaigns, groups]);

  const sortedList = useMemo(() => {
    const copy = [...list];
    copy.sort((a, b) => {
      if (bucket === "active") {
        const ad = a.apply_deadline ? new Date(`${a.apply_deadline}T00:00:00Z`).getTime() : Number.POSITIVE_INFINITY;
        const bd = b.apply_deadline ? new Date(`${b.apply_deadline}T00:00:00Z`).getTime() : Number.POSITIVE_INFINITY;
        if (ad !== bd) return ad - bd;
      }
      const ac = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bc = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bc - ac;
    });
    return copy;
  }, [bucket, list]);

  const activeCount = groups.active.length;
  const closedCount = groups.closedManual.length + groups.expired.length;
  const completedCount = groups.completed.length;

  const stats = [
    { label: "Ativas", value: String(activeCount), icon: Zap, color: "text-primary" },
    { label: "Concluídas", value: String(completedCount), icon: BadgeCheck, color: "text-accent" },
    { label: "Encerradas", value: String(closedCount), icon: TrendingUp, color: "text-muted-foreground" },
  ];

  const tabs = [
    { key: "active" as const, label: `Ativas (${groups.active.length})` },
    { key: "closed_expired" as const, label: `Vencidas (${groups.expired.length})` },
    { key: "closed_manual" as const, label: `Encerradas (${groups.closedManual.length})` },
    { key: "completed" as const, label: `Concluídas (${groups.completed.length})` },
    { key: "draft" as const, label: `Rascunhos (${groups.draft.length})` },
    { key: "deleted" as const, label: `Excluídas (${groups.deleted.length})` },
    { key: "all" as const, label: `Todas (${campaigns.length})` },
  ];

  const menuItems = [
    { icon: Clock, label: "Histórico", description: "Campanhas finalizadas e resultados", route: "/historico" },
    { icon: User, label: "Meu perfil", description: "Dados da conta e configurações", route: "/perfil" },
  ];

  const runAction = async (campaignId: string, action: "close" | "complete" | "delete") => {
    const confirmText =
      action === "delete"
        ? "Tem certeza que deseja excluir esta campanha? Ela ficará como excluída e não aparecerá para influenciadoras."
        : action === "close"
          ? "Encerrar campanha agora? Isso impede novas candidaturas."
          : "Marcar como CONCLUÍDA? Use quando tudo foi entregue corretamente.";

    if (!window.confirm(confirmText)) return;

    setUpdatingId(campaignId);

    try {
      const fn =
        action === "close"
          ? "contractor_close_campaign"
          : action === "complete"
            ? "contractor_mark_campaign_completed"
            : "contractor_delete_campaign";

      const { error } = await supabase.rpc(fn as any, { p_campaign_id: campaignId });

      if (error) {
        const msg = (error.message || "").toLowerCase();
        const looksLikeCache =
          msg.includes("schema cache") ||
          msg.includes("could not find the function") ||
          msg.includes("does not exist");

        if (looksLikeCache) {
          toast.error(
            "Função ainda não apareceu no cache do Supabase. Abra Supabase → Settings → API → Reload schema cache, ou faça hard refresh (Ctrl+Shift+R) e tente novamente."
          );
          console.error("RPC_SCHEMA_CACHE_ERROR", error);
          return;
        }

        throw error;
      }

      if (action === "close") toast.success("Campanha encerrada.");
      if (action === "complete") toast.success("Campanha marcada como concluída.");
      if (action === "delete") toast.success("Campanha excluída.");

      await fetchCampaigns();
    } catch (e: any) {
      console.error("CAMPAIGN_ACTION_ERROR", e);
      toast.error(e?.message || "Erro ao atualizar campanha.");
    } finally {
      setUpdatingId(null);
    }
  };

  const bucketTitle =
    bucket === "active"
      ? "Campanhas ativas"
      : bucket === "closed_expired"
        ? "Campanhas vencidas"
        : bucket === "closed_manual"
          ? "Campanhas encerradas"
          : bucket === "completed"
            ? "Campanhas concluídas"
            : bucket === "draft"
              ? "Rascunhos"
              : bucket === "deleted"
                ? "Excluídas"
                : "Todas as campanhas";

  return (
    <MobileLayout title="Suas campanhas" navType="contractor">
      <div className="px-6 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-muted-foreground text-xs uppercase tracking-widest mb-1">Painel do contratante</p>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Suas <span className="text-gradient-neon">campanhas</span>
          </h2>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-3 gap-3">
              {stats.map((stat) => (
                <div key={stat.label} className="glass-card p-4 flex flex-col items-center text-center gap-2">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  <span className="font-display font-bold text-xl text-foreground">{stat.value}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{stat.label}</span>
                </div>
              ))}
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/criar-campanha")}
              className="w-full py-4 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-sm glow-blue transition-all flex items-center justify-center gap-2.5"
            >
              <Plus className="w-5 h-5" />
              Nova campanha
            </motion.button>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="glass-card p-4 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-foreground font-medium">Dica inteligente:</span> Campanhas regionais têm 3x mais engajamento.
              </p>
            </motion.div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setBucket(t.key)}
                  className={`px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                    bucket === t.key
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "bg-card text-muted-foreground border border-border/50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">{bucketTitle}</p>

              {sortedList.length === 0 ? (
                <div className="py-10 text-center">
                  <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma campanha nessa aba.</p>
                </div>
              ) : (
                sortedList.map((campaign, i) => {
                  const isBusy = updatingId === campaign.id;

                  const deadline = campaign.apply_deadline ?? null;
                  const eventDate = campaign.campaign_date ?? null;
                  const dLeft = deadline ? daysLeftUTC(deadline) : null;

                  const showUrgent =
                    campaign.bucket === "active" &&
                    typeof dLeft === "number" &&
                    dLeft >= 0 &&
                    dLeft <= 2;

                  const isCompleted = campaign.bucket === "completed";

                  return (
                    <motion.div
                      key={campaign.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.12 + i * 0.06 }}
                      className="glass-card-hover p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-foreground text-sm truncate">
                              {campaign.title}
                            </h4>

                            {isCompleted && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-accent/50 bg-accent/15 text-accent font-medium flex items-center gap-1">
                                <BadgeCheck className="w-3 h-3" />
                                Concluída
                              </span>
                            )}

                            {campaign.bucket === "closed_manual" && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-card/60 text-muted-foreground font-medium flex items-center gap-1">
                                <Ban className="w-3 h-3" />
                                Encerrada
                              </span>
                            )}

                            {campaign.bucket === "closed_expired" && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-destructive/30 bg-destructive/5 text-destructive font-medium">
                                Prazo vencido
                              </span>
                            )}

                            {campaign.bucket === "deleted" && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-card/60 text-muted-foreground font-medium flex items-center gap-1">
                                <Trash2 className="w-3 h-3" />
                                Excluída
                              </span>
                            )}

                            {showUrgent && typeof dLeft === "number" && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-warning/30 bg-warning/10 text-warning font-medium flex items-center gap-1">
                                <Flame className="w-3 h-3" />
                                {getUrgencyLabel(dLeft)}
                              </span>
                            )}
                          </div>

                          <p className="text-[10px] text-muted-foreground mt-1">
                            {campaign.city}, {campaign.state} · {campaign.applicant_count ?? 0} candidatura(s)
                          </p>
                        </div>

                        <button
                          onClick={() => navigate(`/campanha/${campaign.id}`)}
                          className="text-muted-foreground hover:text-primary transition-colors"
                          title="Ver detalhes"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-border/50 bg-card/60 px-3 py-2">
                          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            Data do evento
                          </div>
                          <div className="text-sm font-semibold text-foreground mt-0.5">
                            {eventDate ? formatDateBR(eventDate) : "A definir"}
                          </div>
                        </div>

                        <div
                          className={`rounded-xl border px-3 py-2 ${
                            campaign.bucket === "closed_expired"
                              ? "border-destructive/30 bg-destructive/5"
                              : showUrgent
                                ? "border-warning/30 bg-warning/10"
                                : "border-border/50 bg-card/60"
                          }`}
                        >
                          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            <Clock className={`w-3 h-3 ${campaign.bucket === "closed_expired" ? "text-destructive" : showUrgent ? "text-warning" : ""}`} />
                            Prazo candidatura
                          </div>
                          <div className={`text-sm font-semibold mt-0.5 ${campaign.bucket === "closed_expired" ? "text-destructive" : "text-foreground"}`}>
                            {deadline
                              ? campaign.bucket === "closed_expired"
                                ? "Encerrado"
                                : formatDateBR(deadline)
                              : "-"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-border/30 flex gap-2">
                        <button
                          onClick={() => navigate(`/campanha/${campaign.id}`)}
                          className="flex-1 py-2.5 rounded-xl border border-border/50 text-muted-foreground font-medium text-xs hover:text-foreground transition-colors"
                        >
                          Ver
                        </button>

                        {campaign.bucket === "active" && (
                          <button
                            onClick={() => runAction(campaign.id, "close")}
                            disabled={isBusy}
                            className="flex-1 py-2.5 rounded-xl border border-warning/30 bg-warning/10 text-warning font-semibold text-xs disabled:opacity-60"
                          >
                            Encerrar
                          </button>
                        )}

                        {(campaign.bucket === "active" ||
                          campaign.bucket === "closed_manual" ||
                          campaign.bucket === "closed_expired") && (
                          <button
                            onClick={() => runAction(campaign.id, "complete")}
                            disabled={isBusy}
                            className="flex-1 py-2.5 rounded-xl border border-accent/30 bg-accent/10 text-accent font-semibold text-xs disabled:opacity-60"
                          >
                            Concluir
                          </button>
                        )}

                        {campaign.bucket !== "deleted" && (
                          <button
                            onClick={() => runAction(campaign.id, "delete")}
                            disabled={isBusy}
                            className="w-11 py-2.5 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive font-semibold text-xs flex items-center justify-center disabled:opacity-60"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            <div className="space-y-3">
              {menuItems.map((item, i) => (
                <motion.button
                  key={item.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(item.route)}
                  className="w-full glass-card-hover p-5 flex items-center gap-4 text-left group"
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-neon-subtle flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground text-sm">{item.label}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </motion.button>
              ))}
            </div>
          </>
        )}
      </div>
    </MobileLayout>
  );
};

export default ContractorDashboard;