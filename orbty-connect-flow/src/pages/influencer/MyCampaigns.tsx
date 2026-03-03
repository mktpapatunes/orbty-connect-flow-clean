import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Loader2,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  Hourglass,
  BadgeCheck,
  Upload,
} from "lucide-react";

type ParticipantStatus = "invited" | "confirmed" | "delivered" | "approved";

type MyCampaignRow = {
  campaign_id: string;
  title: string;
  type: string;
  state: string;
  city: string;
  campaign_date: string | null; // date
  apply_deadline: string | null; // date
  campaign_status: string; // active (por regra)
  participant_status: ParticipantStatus;

  invited_at: string | null;
  confirmed_at: string | null;
  delivered_at: string | null;
  approved_at: string | null;
};

const formatDateBR = (value?: string | null) => {
  if (!value) return "-";
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = isDateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return isDateOnly ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : d.toLocaleDateString("pt-BR");
};

const statusUi: Record<ParticipantStatus, { label: string; cls: string; Icon: any }> = {
  invited: { label: "Convite", cls: "text-primary", Icon: Hourglass },
  confirmed: { label: "Confirmada", cls: "text-accent", Icon: CheckCircle2 },
  delivered: { label: "Entregue", cls: "text-warning", Icon: Upload },
  approved: { label: "Aprovada", cls: "text-accent", Icon: BadgeCheck },
};

type FilterKey = "all" | ParticipantStatus;

export default function MyCampaigns() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [rows, setRows] = useState<MyCampaignRow[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");

  async function refetch() {
    if (!user) return;
    setIsLoading(true);

    const { data, error } = await supabase.rpc("get_influencer_campaigns_feed" as any);

    if (error) {
      console.error("GET_INFLUENCER_CAMPAIGNS_FEED_ERROR", error);
      setRows([]);
      setIsLoading(false);
      return;
    }

    setRows((data || []) as unknown as MyCampaignRow[]);
    setIsLoading(false);
  }

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const counts = useMemo(() => {
    const invited = rows.filter((r) => r.participant_status === "invited").length;
    const confirmed = rows.filter((r) => r.participant_status === "confirmed").length;
    const delivered = rows.filter((r) => r.participant_status === "delivered").length;
    const approved = rows.filter((r) => r.participant_status === "approved").length;
    return { invited, confirmed, delivered, approved, total: rows.length };
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.participant_status === filter);
  }, [rows, filter]);

  const tabs = [
    { key: "all" as const, label: `Todas (${counts.total})` },
    { key: "invited" as const, label: `Convites (${counts.invited})` },
    { key: "confirmed" as const, label: `Confirmadas (${counts.confirmed})` },
    { key: "delivered" as const, label: `Entregues (${counts.delivered})` },
    { key: "approved" as const, label: `Aprovadas (${counts.approved})` },
  ];

  return (
    <MobileLayout title="Minhas campanhas" navType="influencer">
      <div className="px-6 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Minhas <span className="text-gradient-neon">campanhas</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Aqui aparecem seus convites e participações (somente após a campanha ficar ativa).
          </p>
        </motion.div>

        {!isLoading && rows.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {tabs.map((t) => (
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
            <button
              onClick={refetch}
              className="ml-auto px-3 py-2 rounded-full text-xs font-medium border border-border/50 bg-card/60 text-muted-foreground hover:text-foreground transition"
              title="Atualizar"
            >
              Atualizar
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center">
            <Hourglass className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma campanha por aqui ainda.</p>
            <button
              onClick={() => navigate("/dashboard-influenciadora")}
              className="mt-4 px-4 py-2 rounded-xl border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground transition"
            >
              Ver campanhas disponíveis
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Hourglass className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma campanha nessa aba.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r, i) => {
              const ui = statusUi[r.participant_status];
              const isInvited = r.participant_status === "invited";
              const canOpen = r.participant_status !== "invited"; // após confirmar, já pode abrir detalhes/arquivos

              return (
                <motion.div
                  key={`${r.campaign_id}-${r.participant_status}-${r.invited_at || ""}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.04 }}
                  className="glass-card-hover p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-foreground text-sm truncate">{r.title || "Campanha"}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">{r.type}</p>

                      <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>
                          {r.city}, {r.state}
                        </span>
                      </div>
                    </div>

                    <div className={`flex items-center gap-1 shrink-0 ${ui.cls}`}>
                      <ui.Icon className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{ui.label}</span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-border/50 bg-card/60 px-3 py-2">
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        Data do evento
                      </div>
                      <div className="text-sm font-semibold text-foreground mt-0.5">
                        {r.campaign_date ? formatDateBR(r.campaign_date) : "A definir"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/50 bg-card/60 px-3 py-2">
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        Prazo (registro)
                      </div>
                      <div className="text-sm font-semibold text-foreground mt-0.5">
                        {r.apply_deadline ? formatDateBR(r.apply_deadline) : "-"}
                      </div>
                    </div>
                  </div>

                  {/* CTAs */}
                  <div className="mt-3 pt-3 border-t border-border/30">
                    {isInvited ? (
                      <button
                        onClick={() => navigate(`/campanha/${r.campaign_id}`)}
                        className="w-full py-2.5 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-xs glow-blue"
                      >
                        Confirmar participação
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate(`/campanha-detalhe/${r.campaign_id}`)}
                        disabled={!canOpen}
                        className="w-full py-2.5 rounded-xl border border-accent/30 bg-accent/5 text-accent font-semibold text-xs flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Ver detalhes e arquivos
                      </button>
                    )}
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