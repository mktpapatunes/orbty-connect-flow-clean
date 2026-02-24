import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import {
  Hourglass,
  CheckCircle2,
  XCircle,
  Loader2,
  MapPin,
  Calendar,
  Send,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ApplicationWithCampaign {
  application_id: string;
  campaign_id: string;
  status: string;
  note: string | null;
  applied_at: string;

  campaign_title: string;
  campaign_type: string;
  campaign_city: string;
  campaign_state: string;
  campaign_date: string | null;

  campaign_apply_deadline: string | null;
  campaign_status: string | null;
  campaign_created_at: string | null;
}

/* =========================
   Utils
========================= */

const formatDateBR = (dateString?: string | null) => {
  if (!dateString) return null;

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;

  return date.toLocaleDateString("pt-BR");
};

const isPastDate = (dateString?: string | null) => {
  if (!dateString) return false;
  const today = new Date();
  const date = new Date(dateString);
  return date < today;
};

/* ========================= */

const statusConfig: Record<string, { label: string; color: string; icon: typeof Hourglass }> = {
  pending: { label: "Aguardando", color: "text-warning", icon: Hourglass },
  accepted: { label: "Aprovada", color: "text-accent", icon: CheckCircle2 },
  rejected: { label: "Não selecionada", color: "text-muted-foreground", icon: XCircle },
};

const campaignStatusLabel = (s?: string | null) => {
  if (!s) return null;

  if (s === "active") return { label: "Ativa", cls: "text-primary" };
  if (s === "closed") return { label: "Encerrada", cls: "text-muted-foreground" };
  if (s === "draft") return { label: "Rascunho", cls: "text-muted-foreground" };

  return { label: s, cls: "text-muted-foreground" };
};

const MyApplications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [applications, setApplications] = useState<ApplicationWithCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <MobileLayout title="Minhas candidaturas" navType="influencer">
      <div className="px-6 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Suas <span className="text-gradient-neon">candidaturas</span>
          </h2>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : applications.length === 0 ? (
          <div className="py-12 text-center">
            <Send className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhuma candidatura enviada ainda.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app, i) => {
              const st = statusConfig[app.status] || statusConfig.pending;
              const cs = campaignStatusLabel(app.campaign_status);
              const deadlineExpired = isPastDate(app.campaign_apply_deadline);

              return (
                <motion.div
                  key={app.application_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  className="glass-card-hover p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-foreground text-sm truncate">
                        {app.campaign_title || "Campanha"}
                      </h4>

                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground capitalize">
                          {app.campaign_type || ""}
                        </p>

                        {cs && (
                          <span className={`text-[10px] font-medium ${cs.cls}`}>
                            • {cs.label}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={`flex items-center gap-1 ${st.color}`}>
                      <st.icon className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{st.label}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    {app.campaign_city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {app.campaign_city}, {app.campaign_state}
                      </span>
                    )}

                    {app.campaign_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDateBR(app.campaign_date)}
                      </span>
                    )}

                    {app.campaign_apply_deadline && (
                      <span
                        className={`flex items-center gap-1 ${
                          deadlineExpired ? "text-destructive" : ""
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        Prazo: {formatDateBR(app.campaign_apply_deadline)}
                        {deadlineExpired && " (encerrado)"}
                      </span>
                    )}
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