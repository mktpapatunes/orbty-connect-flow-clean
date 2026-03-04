import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import {
  Plus,
  Users,
  ArrowRight,
  Sparkles,
  Loader2,
  Calendar,
  BadgeCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { MyCampaign } from "@/types/database";

type Bucket = "active" | "completed" | "all";

type MyCampaignRow = MyCampaign & {
  campaign_date?: string | null;
  created_at?: string | null;
  applicant_count?: number;
  bucket?: string;
};

const ContractorCampaigns = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [campaigns, setCampaigns] = useState<MyCampaignRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bucket, setBucket] = useState<Bucket>("active");

  const formatDateBR = (value?: string | null) => {
    if (!value) return "-";
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const d = isDateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return isDateOnly
      ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" })
      : d.toLocaleDateString("pt-BR");
  };

  const fetchCampaigns = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    const { data, error } = await supabase.rpc("get_my_campaigns" as any, {
      p_bucket: "all",
    });

    if (!error && data) {
      // Remover completamente do front tudo que estiver marcado como deleted
      const rows = (data as unknown as MyCampaignRow[]).filter(
        (c) => c.bucket !== "deleted"
      );
      setCampaigns(rows);
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
    const completed = campaigns.filter((c) => c.bucket === "completed");
    return { active, completed };
  }, [campaigns]);

  const list = useMemo(() => {
    if (bucket === "active") return groups.active;
    if (bucket === "completed") return groups.completed;
    return campaigns;
  }, [bucket, campaigns, groups]);

  const sortedList = useMemo(() => {
    const copy = [...list];
    copy.sort((a, b) => {
      const ac = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bc = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bc - ac;
    });
    return copy;
  }, [list]);

  const tabs = [
    { key: "active" as const, label: `Ativas (${groups.active.length})` },
    { key: "completed" as const, label: `Concluídas (${groups.completed.length})` },
    { key: "all" as const, label: `Todas (${campaigns.length})` },
  ];

  const bucketTitle =
    bucket === "active"
      ? "Campanhas ativas"
      : bucket === "completed"
        ? "Campanhas concluídas"
        : "Todas as campanhas";

  return (
    <MobileLayout title="Minhas campanhas" navType="contractor">
      <div className="px-6 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-muted-foreground text-xs uppercase tracking-widest mb-1">
            Painel do contratante
          </p>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Minhas <span className="text-gradient-neon">campanhas</span>
          </h2>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <>
            {/* CTA criar */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/criar-campanha")}
              className="w-full py-4 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-sm glow-blue transition-all flex items-center justify-center gap-2.5"
            >
              <Plus className="w-5 h-5" />
              Nova campanha
            </motion.button>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.18 }}
              className="glass-card p-4 flex items-start gap-3"
            >
              <Sparkles className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-foreground font-medium">Dica inteligente:</span>{" "}
                Campanhas regionais têm 3x mais engajamento.
              </p>
            </motion.div>

            {/* Tabs */}
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

            {/* Lista */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
                {bucketTitle}
              </p>

              {sortedList.length === 0 ? (
                <div className="py-10 text-center">
                  <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma campanha nessa aba.
                  </p>
                </div>
              ) : (
                sortedList.map((campaign, i) => {
                  const eventDate = campaign.campaign_date ?? null;
                  const isCompleted = campaign.bucket === "completed";

                  return (
                    <motion.div
                      key={campaign.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.06 + i * 0.05 }}
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
                          </div>

                          <p className="text-[10px] text-muted-foreground mt-1">
                            {campaign.city}, {campaign.state} ·{" "}
                            {campaign.applicant_count ?? 0} candidatura(s)
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

                      <div className="mt-3">
                        <div className="rounded-xl border border-border/50 bg-card/60 px-3 py-2">
                          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            Data do evento
                          </div>
                          <div className="text-sm font-semibold text-foreground mt-0.5">
                            {eventDate ? formatDateBR(eventDate) : "A definir"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-border/30 flex gap-2">
                        <button
                          onClick={() => navigate(`/campanha/${campaign.id}`)}
                          className="w-full py-2.5 rounded-xl border border-border/50 text-muted-foreground font-medium text-xs hover:text-foreground transition-colors"
                        >
                          Ver
                        </button>
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

export default ContractorCampaigns;