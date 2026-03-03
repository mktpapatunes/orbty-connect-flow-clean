import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import { Loader2, MapPin, CheckCircle2, BadgeCheck, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type CreatorCampaign = {
  id: string;
  title: string;
  type: string | null;
  region: string | null;
  state: string | null;
  city: string | null;
  campaign_date: string | null;
  brief_public: string | null;
  brief_private?: string | null;
  requirements?: Record<string, any> | null;
  status: string | null; // active | completed | deleted | etc
  created_at: string | null;

  // opcional (se você quiser controlar o “aceitei participar”)
  creator_accepted?: boolean | null;
};

type FilterKey = "all" | "active" | "completed";

const formatDateBR = (value?: string | null) => {
  if (!value) return "-";
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = isDateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return isDateOnly ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : d.toLocaleDateString("pt-BR");
};

export default function InfluencerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [items, setItems] = useState<CreatorCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");

  const fetchData = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    const { data, error } = await supabase.rpc("get_creator_campaigns_feed" as any);

    if (error) {
      console.error("GET_CREATOR_CAMPAIGNS_FEED_ERROR", error);
      toast.error("Erro ao carregar suas campanhas.");
      setItems([]);
      setIsLoading(false);
      return;
    }

    // remove deleted no front
    const cleaned = ((data || []) as any[]).filter((c) => c?.status !== "deleted");

    setItems(cleaned as CreatorCampaign[]);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const counts = useMemo(() => {
    const active = items.filter((c) => c.status === "active").length;
    const completed = items.filter((c) => c.status === "completed").length;
    return { total: items.length, active, completed };
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((c) => c.status === filter);
  }, [items, filter]);

  return (
    <MobileLayout title="Minhas campanhas" navType="influencer">
      <div className="px-6 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-muted-foreground text-xs uppercase tracking-widest mb-1">Painel do creator</p>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Minhas <span className="text-gradient-neon">campanhas</span>
          </h2>
        </motion.div>

        {/* contadores simples */}
        {!isLoading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="grid grid-cols-3 gap-3">
            <div className="glass-card p-4 flex flex-col items-center text-center gap-1">
              <Clock className="w-5 h-5 text-primary" />
              <span className="font-display font-bold text-xl text-foreground">{counts.active}</span>
              <span className="text-[10px] text-muted-foreground">Ativas</span>
            </div>
            <div className="glass-card p-4 flex flex-col items-center text-center gap-1">
              <BadgeCheck className="w-5 h-5 text-accent" />
              <span className="font-display font-bold text-xl text-foreground">{counts.completed}</span>
              <span className="text-[10px] text-muted-foreground">Concluídas</span>
            </div>
            <div className="glass-card p-4 flex flex-col items-center text-center gap-1">
              <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
              <span className="font-display font-bold text-xl text-foreground">{counts.total}</span>
              <span className="text-[10px] text-muted-foreground">Total</span>
            </div>
          </motion.div>
        )}

        {/* filtros */}
        {!isLoading && items.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { key: "all" as const, label: `Todas (${counts.total})` },
              { key: "active" as const, label: `Ativas (${counts.active})` },
              { key: "completed" as const, label: `Concluídas (${counts.completed})` },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  filter === t.key
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-card text-muted-foreground border border-border/50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma campanha disponível para você no momento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c, i) => {
              const isCompleted = c.status === "completed";

              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 + i * 0.05 }}
                  className="glass-card-hover p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-foreground text-sm truncate">{c.title}</h4>

                        {isCompleted ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-accent/40 bg-accent/10 text-accent font-medium flex items-center gap-1">
                            <BadgeCheck className="w-3 h-3" />
                            Concluída
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary font-medium">
                            Ativa
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-1 capitalize">{c.type || ""}</p>
                    </div>

                    <button
                      onClick={() => navigate(`/campanha-detalhe/${c.id}`)}
                      className="shrink-0 px-3 py-2 rounded-xl border border-border/50 bg-card/60 text-xs font-medium text-muted-foreground hover:text-foreground transition"
                    >
                      Ver detalhes
                    </button>
                  </div>

                  {c.brief_public && <p className="text-xs text-foreground/60 mt-3 line-clamp-2">{c.brief_public}</p>}

                  <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>
                      {c.city}, {c.state}
                    </span>
                    <span className="mx-2">•</span>
                    <span>Evento: {c.campaign_date ? formatDateBR(c.campaign_date) : "A definir"}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}