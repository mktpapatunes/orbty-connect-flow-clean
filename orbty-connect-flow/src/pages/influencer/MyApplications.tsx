import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import { Hourglass, CheckCircle2, XCircle, Loader2, MapPin, Calendar, Send, Clock, Ban, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ApplicationWithCampaign {
  application_id: string;
  campaign_id: string;
  status: string; // pending | accepted | rejected
  note: string | null;
  applied_at: string;

  campaign_title: string;
  campaign_type: string;
  campaign_city: string;
  campaign_state: string;
  campaign_date: string | null;

  campaign_apply_deadline: string | null;
  campaign_status: string | null; // active | closed | draft | closed_manual | completed | deleted ...
  campaign_created_at: string | null;
}

const formatDateBR = (value?: string | null) => {
  if (!value) return null;
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = isDateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return isDateOnly ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : d.toLocaleDateString("pt-BR");
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

const statusConfig: Record<string, { label: string; color: string; icon: typeof Hourglass }> = {
  pending: { label: "Aguardando", color: "text-warning", icon: Hourglass },
  accepted: { label: "Aprovada", color: "text-accent", icon: CheckCircle2 },
  rejected: { label: "Não selecionada", color: "text-muted-foreground", icon: XCircle },
};

const campaignStatusLabel = (status?: string | null, deadlineExpired?: boolean) => {
  if (!status) return null;

  if (status === "active" && deadlineExpired) return { label: "Prazo vencido", cls: "text-destructive" };
  if (status === "active") return { label: "Ativa", cls: "text-primary" };

  if (status === "closed_manual") return { label: "Encerrada", cls: "text-muted-foreground" };
  if (status === "completed") return { label: "Concluída", cls: "text-accent" };
  if (status === "deleted") return { label: "Excluída", cls: "text-muted-foreground" };

  if (status === "closed") return { label: "Encerrada", cls: "text-muted-foreground" };
  if (status === "draft") return { label: "Rascunho", cls: "text-muted-foreground" };

  return { label: status, cls: "text-muted-foreground" };
};

type FilterKey = "all" | "pending" | "accepted" | "rejected" | "completed";

const MyApplications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [applications, setApplications] = useState<ApplicationWithCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    const fetchApplications = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      const { data, error } = await supabase.rpc("get_my_applications_feed" as any);

      if (error) {
        console.error("MY_APPLICATIONS_FEED_ERROR", error);
        setApplications([]);
        setIsLoading(false);
        return;
      }

      setApplications(((data || []) as unknown) as ApplicationWithCampaign[]);
      setIsLoading(false);
    };

    fetchApplications();
  }, [user]);

  const counts = useMemo(() => {
    const completed = applications.filter((a) => a.campaign_status === "completed").length;
    const pending = applications.filter((a) => a.status === "pending").length;
    const accepted = applications.filter((a) => a.status === "accepted").length;
    const rejected = applications.filter((a) => a.status === "rejected").length;
    return { completed, pending, accepted, rejected, total: applications.length };
  }, [applications]);

  const filteredSorted = useMemo(() => {
    const base =
      filter === "all"
        ? applications
        : filter === "completed"
        ? applications.filter((a) => a.campaign_status === "completed")
        : applications.filter((a) => a.status === filter);

    const rank = (a: ApplicationWithCampaign) => {
      if (a.campaign_status === "completed") return 0;
      if (a.status === "accepted") return 1;
      if (a.status === "pending") return 2;
      return 3;
    };

    const dateKey = (a: ApplicationWithCampaign) => {
      const eventMs = toUTCDateMs(a.campaign_date);
      if (eventMs !== null) return eventMs;

      const deadlineMs = toUTCDateMs(a.campaign_apply_deadline);
      if (deadlineMs !== null) return deadlineMs;

      const appliedMs = new Date(a.applied_at).getTime();
      return Number.isNaN(appliedMs) ? 0 : appliedMs;
    };

    return [...base].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;

      if (ra === 2) return dateKey(a) - dateKey(b);
      return dateKey(b) - dateKey(a);
    });
  }, [applications, filter]);

  const tabs = [
    { key: "all" as const, label: `Todas (${counts.total})` },
    { key: "pending" as const, label: `Aguardando (${counts.pending})` },
    { key: "accepted" as const, label: `Aprovadas (${counts.accepted})` },
    { key: "rejected" as const, label: `Não selecionadas (${counts.rejected})` },
    { key: "completed" as const, label: `Concluídas (${counts.completed})` },
  ];

  return (
    <MobileLayout title="Minhas candidaturas" navType="influencer">
      <div className="px-6 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Suas <span className="text-gradient-neon">candidaturas</span>
          </h2>
        </motion.div>

        {!isLoading && applications.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  filter === t.key ? "bg-primary/10 text-primary border border-primary/30" : "bg-card text-muted-foreground border border-border/50"
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
        ) : applications.length === 0 ? (
          <div className="py-12 text-center">
            <Send className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma candidatura enviada ainda.</p>
          </div>
        ) : filteredSorted.length === 0 ? (
          <div className="py-12 text-center">
            <Send className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma candidatura nessa aba.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSorted.map((app, i) => {
              const st = statusConfig[app.status] || statusConfig.pending;
              const deadlineExpired = isPastDateUTC(app.campaign_apply_deadline);
              const cs = campaignStatusLabel(app.campaign_status, deadlineExpired);

              const isCompleted = app.campaign_status === "completed";
              const isDeleted = app.campaign_status === "deleted";
              const isClosedManual = app.campaign_status === "closed_manual" || app.campaign_status === "closed";

              return (
                <motion.div
                  key={app.application_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.05 }}
                  className="glass-card-hover p-4"
                >
                  <div className="flex items-start justify-between mb-2 gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-foreground text-sm truncate">{app.campaign_title || "Campanha"}</h4>

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

                        {isDeleted && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-card/60 text-muted-foreground font-medium flex items-center gap-1">
                            <Trash2 className="w-3 h-3" />
                            Excluída
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-xs text-muted-foreground capitalize">{app.campaign_type || ""}</p>
                        {cs && <span className={`text-[10px] font-medium ${cs.cls}`}>• {cs.label}</span>}
                      </div>
                    </div>

                    <div className={`flex items-center gap-1 shrink-0 ${st.color}`}>
                      <st.icon className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{st.label}</span>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    {app.campaign_city && (
                      <>
                        <MapPin className="w-3 h-3" />
                        <span>
                          {app.campaign_city}, {app.campaign_state}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-border/50 bg-card/60 px-3 py-2">
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        Data do evento
                      </div>
                      <div className="text-sm font-semibold text-foreground mt-0.5">
                        {app.campaign_date ? formatDateBR(app.campaign_date) : "A definir"}
                      </div>
                    </div>

                    <div className={`rounded-xl border px-3 py-2 ${deadlineExpired ? "border-destructive/30 bg-destructive/5" : "border-border/50 bg-card/60"}`}>
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <Clock className={`w-3 h-3 ${deadlineExpired ? "text-destructive" : ""}`} />
                        Prazo candidatura
                      </div>
                      <div className={`text-sm font-semibold mt-0.5 ${deadlineExpired ? "text-destructive" : "text-foreground"}`}>
                        {app.campaign_apply_deadline ? (deadlineExpired ? "Encerrado" : formatDateBR(app.campaign_apply_deadline)) : "-"}
                      </div>
                    </div>
                  </div>

                  {app.status === "accepted" && (
                    <button
                      onClick={() => navigate(`/campanha-detalhe/${app.campaign_id}`)}
                      className="mt-3 w-full py-2.5 rounded-xl border border-accent/30 bg-accent/5 text-accent font-semibold text-xs flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Ver detalhes completos
                    </button>
                  )}
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