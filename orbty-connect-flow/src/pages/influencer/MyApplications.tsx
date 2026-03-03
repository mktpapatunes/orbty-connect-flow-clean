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
  Hourglass,
  CheckCircle2,
  BadgeCheck,
  Upload,
  Ban,
  Trash2,
} from "lucide-react";

type ParticipantStatus = "invited" | "confirmed" | "delivered" | "approved";

type FeedRow = {
  campaign_id: string;
  title: string;
  type: string;
  state: string;
  city: string;
  campaign_date: string | null;
  apply_deadline: string | null;

  // pode variar conforme seu RPC — tratamos defensivamente
  campaign_status: string | null; // active | closed_manual | closed_expired | completed | deleted | draft ...
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
  return isDateOnly
    ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : d.toLocaleDateString("pt-BR");
};

const isPastDateUTC = (dateString?: string | null) => {
  if (!dateString) return false;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return new Date(dateString) < new Date();
  }

  const deadlineUTC = new Date(`${dateString}T00:00:00Z`);
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return deadlineUTC.getTime() < todayUTC.getTime();
};

const toUTCDateMs = (dateString?: string | null) => {
  if (!dateString) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const t = new Date(dateString).getTime();
    return Number.isNaN(t) ? null : t;
  }
  const t = new Date(`${dateString}T00:00:00Z`).getTime();
  return Number.isNaN(t) ? null : t;
};

const statusUi: Record<ParticipantStatus, { label: string; cls: string; Icon: any }> = {
  invited: { label: "Convite", cls: "text-primary", Icon: Hourglass },
  confirmed: { label: "Confirmada", cls: "text-accent", Icon: CheckCircle2 },
  delivered: { label: "Entregue", cls: "text-warning", Icon: Upload },
  approved: { label: "Aprovada", cls: "text-accent", Icon: BadgeCheck },
};

type FilterKey = "all" | "history" | "approved" | "completed" | "deleted";

function isHistoryRow(r: FeedRow) {
  // Histórico do influencer:
  // - participação aprovada
  // - ou campanha encerrada/concluída/excluída (caso apareça no feed)
  const cs = (r.campaign_status || "").toLowerCase();
  const ps = (r.participant_status || "").toLowerCase();

  if (ps === "approved") return true;

  if (cs === "completed") return true;
  if (cs === "closed_manual") return true;
  if (cs === "closed_expired") return true;
  if (cs === "deleted") return true;

  return false;
}

const MyApplications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [filter, setFilter] = useState<FilterKey>("history"); // ✅ default já abre no histórico

  async function refetch() {
    if (!user) return;
    setIsLoading(true);

    // ✅ novo: usa o feed atual (mesmo do MyCampaigns)
    const { data, error } = await supabase.rpc("get_influencer_campaigns_feed" as any);

    if (error) {
      console.error("GET_INFLUENCER_CAMPAIGNS_FEED_ERROR", error);
      setRows([]);
      setIsLoading(false);
      return;
    }

    const cleaned = ((data || []) as any[]).filter((x) => x?.campaign_id);
    setRows(cleaned as FeedRow[]);
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
    const approved = rows.filter((r) => (r.participant_status || "").toLowerCase() === "approved").length;
    const completed = rows.filter((r) => (r.campaign_status || "").toLowerCase() === "completed").length;
    const deleted = rows.filter((r) => (r.campaign_status || "").toLowerCase() === "deleted").length;
    const history = rows.filter(isHistoryRow).length;
    return { approved, completed, deleted, history, total: rows.length };
  }, [rows]);

  const filteredSorted = useMemo(() => {
    const base =
      filter === "all"
        ? rows
        : filter === "history"
          ? rows.filter(isHistoryRow)
          : filter === "approved"
            ? rows.filter((r) => (r.participant_status || "").toLowerCase() === "approved")
            : filter === "completed"
              ? rows.filter((r) => (r.campaign_status || "").toLowerCase() === "completed")
              : rows.filter((r) => (r.campaign_status || "").toLowerCase() === "deleted");

    // ordenação: mais recente primeiro (por data do evento > prazo > timestamps)
    const dateKey = (r: FeedRow) => {
      const eventMs = toUTCDateMs(r.campaign_date);
      if (eventMs !== null) return eventMs;

      const deadlineMs = toUTCDateMs(r.apply_deadline);
      if (deadlineMs !== null) return deadlineMs;

      const anyMs = toUTCDateMs(r.approved_at) ?? toUTCDateMs(r.delivered_at) ?? toUTCDateMs(r.confirmed_at) ?? toUTCDateMs(r.invited_at);
      if (anyMs !== null) return anyMs;

      return 0;
    };

    return [...base].sort((a, b) => dateKey(b) - dateKey(a));
  }, [rows, filter]);

  const tabs = [
    { key: "history" as const, label: `Histórico (${counts.history})` },
    { key: "approved" as const, label: `Aprovadas (${counts.approved})` },
    { key: "completed" as const, label: `Concluídas (${counts.completed})` },
    { key: "deleted" as const, label: `Excluídas (${counts.deleted})` },
    { key: "all" as const, label: `Todas (${counts.total})` },
  ];

  return (
    <MobileLayout title="Histórico" navType="influencer">
      <div className="px-6 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Seu <span className="text-gradient-neon">histórico</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Aqui ficam suas participações aprovadas e campanhas encerradas/concluídas.
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
        ) : filteredSorted.length === 0 ? (
          <div className="py-12 text-center">
            <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nada no histórico ainda.</p>

            <button
              onClick={() => navigate("/minhas-campanhas")}
              className="mt-4 px-4 py-2 rounded-xl border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground transition"
            >
              Ir para minhas campanhas
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSorted.map((r, i) => {
              const ps = (r.participant_status || "invited") as ParticipantStatus;
              const ui = statusUi[ps] || statusUi.invited;

              const cs = (r.campaign_status || "").toLowerCase();
              const deadlineExpired = isPastDateUTC(r.apply_deadline);

              const isCompleted = cs === "completed";
              const isDeleted = cs === "deleted";
              const isClosedManual = cs === "closed_manual";
              const isClosedExpired = cs === "closed_expired";

              return (
                <motion.div
                  key={`${r.campaign_id}-${r.participant_status}-${r.invited_at || ""}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.05 }}
                  className="glass-card-hover p-4"
                >
                  <div className="flex items-start justify-between mb-2 gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-foreground text-sm truncate">{r.title || "Campanha"}</h4>

                        {isCompleted && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-accent/30 bg-accent/10 text-accent font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Concluída
                          </span>
                        )}

                        {isClosedManual && !isCompleted && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-card/60 text-muted-foreground font-medium flex items-center gap-1">
                            <Ban className="w-3 h-3" />
                            Encerrada
                          </span>
                        )}

                        {isClosedExpired && !isCompleted && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-destructive/30 bg-destructive/5 text-destructive font-medium">
                            Prazo vencido
                          </span>
                        )}

                        {isDeleted && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-card/60 text-muted-foreground font-medium flex items-center gap-1">
                            <Trash2 className="w-3 h-3" />
                            Excluída
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">{r.type || ""}</p>
                    </div>

                    <div className={`flex items-center gap-1 shrink-0 ${ui.cls}`}>
                      <ui.Icon className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{ui.label}</span>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    {r.city ? (
                      <>
                        <MapPin className="w-3 h-3" />
                        <span>
                          {r.city}, {r.state}
                        </span>
                      </>
                    ) : null}
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

                    <div
                      className={`rounded-xl border px-3 py-2 ${
                        deadlineExpired ? "border-destructive/30 bg-destructive/5" : "border-border/50 bg-card/60"
                      }`}
                    >
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <Clock className={`w-3 h-3 ${deadlineExpired ? "text-destructive" : ""}`} />
                        Prazo (registro)
                      </div>
                      <div className={`text-sm font-semibold mt-0.5 ${deadlineExpired ? "text-destructive" : "text-foreground"}`}>
                        {r.apply_deadline ? (deadlineExpired ? "Encerrado" : formatDateBR(r.apply_deadline)) : "-"}
                      </div>
                    </div>
                  </div>

                  {/* CTA: sempre abre detalhes (ou confirmação se ainda for convite) */}
                  <div className="mt-3 pt-3 border-t border-border/30">
                    {ps === "invited" ? (
                      <button
                        onClick={() => navigate(`/campanha/${r.campaign_id}`)}
                        className="w-full py-2.5 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-xs glow-blue"
                      >
                        Ver convite
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate(`/campanha-detalhe/${r.campaign_id}`)}
                        className="w-full py-2.5 rounded-xl border border-accent/30 bg-accent/5 text-accent font-semibold text-xs flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Ver detalhes
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
};

export default MyApplications;