import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import { Plus, Clock, User, Zap, TrendingUp, Users, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { MyCampaign } from "@/types/database";

const ContractorDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<MyCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc("get_my_campaigns" as any);

    if (!error && data) {
      setCampaigns(data as unknown as MyCampaign[]);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const activeCount = campaigns.filter((c) => c.status === "active").length;
  const closedCount = campaigns.filter((c) => c.status === "closed").length;

  const stats = [
    { label: "Ativas", value: String(activeCount), icon: Zap, color: "text-primary" },
    { label: "Encerradas", value: String(closedCount), icon: TrendingUp, color: "text-accent" },
    { label: "Total", value: String(campaigns.length), icon: Users, color: "text-neon-cyan" },
  ];

  const menuItems = [
    { icon: Clock, label: "Histórico", description: "Campanhas finalizadas e resultados", route: "/historico" },
    { icon: User, label: "Meu perfil", description: "Dados da conta e configurações", route: "/perfil" },
  ];

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

            {/* Active campaigns */}
            {campaigns.filter((c) => c.status === "active").length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Campanhas ativas</p>
                {campaigns.filter((c) => c.status === "active").map((campaign, i) => (
                  <motion.button
                    key={campaign.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.08 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/campanha/${campaign.id}`)}
                    className="w-full glass-card-hover p-4 flex items-center gap-3 text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground text-sm truncate">{campaign.title}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {campaign.city}, {campaign.state} · {campaign.applicant_count} candidatura(s)
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </motion.button>
                ))}
              </div>
            )}

            {/* Draft campaigns */}
            {campaigns.filter((c) => c.status === "draft").length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Rascunhos</p>
                {campaigns.filter((c) => c.status === "draft").map((campaign, i) => (
                  <motion.button
                    key={campaign.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.08 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/campanha/${campaign.id}`)}
                    className="w-full glass-card-hover p-4 flex items-center gap-3 text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground text-sm truncate">{campaign.title}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Rascunho</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </motion.button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {menuItems.map((item, i) => (
                <motion.button
                  key={item.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
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
