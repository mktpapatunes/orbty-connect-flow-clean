import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import {
  MapPin,
  Calendar,
  FileText,
  Users,
  Send,
  Loader2,
  CheckCircle2,
  Hourglass,
  XCircle,
  Clock,
  Flame,
  BarChart3,
  History,
  BadgeCheck,
  Ban,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { PublicCampaignFeed, CampaignApplicant } from "@/types/database";

type CampaignTimelineRow = {
  event_id: string;
  campaign_id: string;
  event_type: string;
  created_at: string;
  actor_id: string | null;
  actor_role: string | null;

  actor_name: string | null;

  application_id: string | null;
  influencer_id: string | null;
  influencer_name: string | null;
  influencer_instagram: string | null;

  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  note: string | null;
};

type CampaignMetrics = {
  campaign_id: string;
  campaign_status: string;
  total_applications: number;
  accepted_applications: number;
  rejected_applications: number;
  pending_applications: number;
  approval_rate: number;
};

const CampaignView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, userRole } = useAuth();

  const [campaign, setCampaign] = useState<PublicCampaignFeed | null>(null);
  const [applicants, setApplicants] = useState<CampaignApplicant[]>([]);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [tab, setTab] = useState<"details" | "applicants" | "history">("details");

  const [timeline, setTimeline] = useState<CampaignTimelineRow[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const [metrics, setMetrics] = useState<CampaignMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const isContractor = userRole === "contractor";

  // ✅ Formata datas para pt-BR (DD/MM/AAAA) sem bug de fuso em YYYY-MM-DD
  const formatDateBR = (value?: string | null) => {
    if (!value) return "-";
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const d = isDateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return isDateOnly ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : d.toLocaleDateString("pt-BR");
  };

  const formatDateTimeBR = (value?: string | null) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("pt-BR");
  };

  // ✅ Dias restantes (UTC) para um DATE do banco (YYYY-MM-DD)
  const daysLeftUTC = (applyDeadline?: string | null) => {
    if (!applyDeadline) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(applyDeadline)) return null;

    const deadlineUTC = new Date(`${applyDeadline}T00:00:00Z`);
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const diffMs = deadlineUTC.getTime() - todayUTC.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  const isExpired = (applyDeadline?: string | null) => {
    const d = daysLeftUTC(applyDeadline);
    return typeof d === "number" ? d < 0 : false;
  };

  const getUrgencyLabel = (daysLeft: number) => {
    if (daysLeft <= 0) return "Termina hoje";
    if (daysLeft === 1) return "Termina amanhã";
    return `Faltam ${daysLeft} dias`;
  };

  const normalizeAt = (handle?: string | null) => {
    if (!handle) return null;
    const h = handle.trim();
    if (!h) return null;
    return h.startsWith("@") ? h : `@${h}`;
  };

  const statusLabel = (s?: string | null) => {
    if (!s) return "—";
    if (s === "active") return "Ativa";
    if (s === "closed_manual") return "Encerrada (manual)";
    if (s === "closed_expired") return "Encerrada (prazo)";
    if (s === "completed") return "Concluída";
    if (s === "deleted") return "Excluída";
    return s;
  };

  // ✅ Só eventos “ação do contratante” devem exibir "por <nome>"
  const isContractorActionEvent = (t: CampaignTimelineRow) => {
    if (t.event_type === "application.accepted") return true;
    if (t.event_type === "application.rejected") return true;

    if (t.event_type === "campaign.status_changed") {
      // quando status foi alterado via ações do contratante
      if (t.to_status === "closed_manual") return true;
      if (t.to_status === "completed") return true;
      if (t.to_status === "deleted") return true;
    }

    return false;
  };

  const timelineIconFor = (t: CampaignTimelineRow) => {
    if (t.event_type === "application.submitted") return Send;
    if (t.event_type === "application.accepted") return CheckCircle2;
    if (t.event_type === "application.rejected") return XCircle;
    if (t.event_type === "campaign.status_changed") {
      if (t.to_status === "completed") return BadgeCheck;
      if (t.to_status === "closed_manual") return Ban;
      if (t.to_status === "closed_expired") return Clock;
      if (t.to_status === "deleted") return Trash2;
      return CheckCircle2;
    }
    return History;
  };

  const timelineTitleFor = (t: CampaignTimelineRow) => {
    const name = t.influencer_name || "Creator";
    const ig = normalizeAt(t.influencer_instagram);

    if (t.event_type === "application.submitted") {
      return ig ? `Candidatura enviada por ${name} (${ig})` : `Candidatura enviada por ${name}`;
    }
    if (t.event_type === "application.accepted") {
      return ig ? `Creator aprovado: ${name} (${ig})` : `Creator aprovado: ${name}`;
    }
    if (t.event_type === "application.rejected") {
      return ig ? `Creator recusado: ${name} (${ig})` : `Creator recusado: ${name}`;
    }
    if (t.event_type === "campaign.status_changed") {
      return `Status atualizado: ${statusLabel(t.from_status)} → ${statusLabel(t.to_status)}`;
    }
    return "Evento";
  };

  const timelineSubFor = (t: CampaignTimelineRow) => {
    const when = formatDateTimeBR(t.created_at);

    // ✅ Apenas em ações do contratante: exibir "por Nome"
    if (isContractorActionEvent(t)) {
      const by = t.actor_name ? `por ${t.actor_name}` : "por contratante";
      if (t.event_type === "campaign.status_changed" && t.reason) {
        return `${when} · ${by} · Motivo: ${t.reason}`;
      }
      return `${when} · ${by}`;
    }

    // demais: minimalista (sem "por")
    if (t.event_type === "application.submitted") {
      return t.note ? `${when} · Nota: "${t.note}"` : when;
    }
    if (t.event_type === "campaign.status_changed" && t.reason) {
      return `${when} · Motivo: ${t.reason}`;
    }
    return when;
  };

  const fetchTimeline = useCallback(async () => {
    if (!id || !user) return;

    setTimelineLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_campaign_timeline" as any, {
        p_campaign_id: id,
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();
        const looksMissing =
          msg.includes("could not find the function") ||
          msg.includes("does not exist") ||
          msg.includes("schema cache");

        if (!looksMissing) console.error("GET_CAMPAIGN_TIMELINE_ERROR", error);

        setTimeline([]);
        return;
      }

      setTimeline((data || []) as unknown as CampaignTimelineRow[]);
    } finally {
      setTimelineLoading(false);
    }
  }, [id, user]);

  const fetchMetrics = useCallback(async () => {
    if (!id || !user || !isContractor) return;

    setMetricsLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_campaign_metrics" as any, {
        p_campaign_id: id,
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();
        const missing =
          msg.includes("could not find the function") ||
          msg.includes("does not exist") ||
          msg.includes("schema cache");

        if (!missing) console.error("CAMPAIGN_METRICS_ERROR", error);

        setMetrics(null);
        return;
      }

      const row = Array.isArray(data) ? (data[0] as any) : (data as any);
      if (!row) {
        setMetrics(null);
        return;
      }

      setMetrics({
        campaign_id: String(row.campaign_id),
        campaign_status: String(row.campaign_status),
        total_applications: Number(row.total_applications ?? 0),
        accepted_applications: Number(row.accepted_applications ?? 0),
        rejected_applications: Number(row.rejected_applications ?? 0),
        pending_applications: Number(row.pending_applications ?? 0),
        approval_rate: Number(row.approval_rate ?? 0),
      });
    } finally {
      setMetricsLoading(false);
    }
  }, [id, user, isContractor]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id || !user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        if (isContractor) {
          const { data: campaignData, error: campaignError } = await supabase
            .from("campaigns")
            .select("*")
            .eq("id", id)
            .eq("created_by", user.id)
            .maybeSingle();

          if (campaignError) console.error("CAMPAIGNVIEW_CONTRACTOR_FETCH_ERROR", campaignError);

          setCampaign((campaignData ?? null) as unknown as PublicCampaignFeed);

          const { data: applicantData, error: applicantsError } = await supabase.rpc("get_campaign_applicants" as any, {
            p_campaign_id: id,
          });

          if (applicantsError) console.error("CAMPAIGNVIEW_APPLICANTS_ERROR", applicantsError);

          setApplicants((applicantData || []) as unknown as CampaignApplicant[]);

          fetchMetrics();
        } else {
          const { data: feedData, error: feedError } = await supabase.rpc("get_campaigns_public_feed" as any);

          if (feedError) console.error("CAMPAIGNVIEW_PUBLIC_FEED_ERROR", feedError);

          const found = ((feedData || []) as unknown as PublicCampaignFeed[]).find((c) => c.id === id);
          setCampaign(found || null);

          const { data: appData, error: appError } = await supabase
            .from("campaign_applications")
            .select("status")
            .eq("campaign_id", id)
            .eq("influencer_id", user.id)
            .maybeSingle();

          if (appError) console.error("CAMPAIGNVIEW_APPLICATION_STATUS_ERROR", appError);

          if (appData) setApplicationStatus((appData as any).status);
        }
      } catch (e) {
        console.error("CAMPAIGNVIEW_UNEXPECTED_ERROR", e);
        setCampaign(null);
        setApplicants([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, isContractor]);

  useEffect(() => {
    if (tab === "history") fetchTimeline();
  }, [tab, fetchTimeline]);

  const handleApply = async () => {
    if (!id || !user) return;

    const deadline = (campaign as any)?.apply_deadline ?? null;
    if (deadline && isExpired(deadline)) {
      toast.error("Prazo de candidatura encerrado.");
      return;
    }

    setIsApplying(true);

    const { error } = await supabase.rpc("apply_to_campaign" as any, {
      p_campaign_id: id,
    });

    if (error) {
      console.error("Apply error:", error);
      const msg = error.message || "Erro ao se candidatar.";
      const lower = msg.toLowerCase();

      if (lower.includes("deadline passed")) toast.error("Prazo de candidatura encerrado.");
      else if (lower.includes("user not approved") || lower.includes("not approved"))
        toast.error("Seu perfil ainda está em análise. Aguarde aprovação.");
      else if (lower.includes("only influencers")) toast.error("Apenas influenciadoras podem se candidatar.");
      else toast.error(msg);
    } else {
      toast.success("Candidatura enviada!");
      setApplicationStatus("pending");
    }

    setIsApplying(false);
  };

  const handleDecide = async (applicationId: string, decision: "accepted" | "rejected") => {
    setUpdatingId(applicationId);

    const { error } = await supabase.rpc("contractor_decide_application" as any, {
      p_application_id: applicationId,
      p_decision: decision,
    });

    if (error) {
      toast.error("Erro ao atualizar candidatura.");
    } else {
      toast.success(decision === "accepted" ? "Influenciadora aprovada!" : "Candidatura recusada.");

      const { data: applicantData, error: applicantsError } = await supabase.rpc("get_campaign_applicants" as any, {
        p_campaign_id: id,
      });

      if (applicantsError) console.error("CAMPAIGNVIEW_APPLICANTS_REFRESH_ERROR", applicantsError);

      setApplicants((applicantData || []) as unknown as CampaignApplicant[]);

      fetchMetrics();
      if (tab === "history") fetchTimeline();
    }

    setUpdatingId(null);
  };

  const backTo = isContractor ? "/dashboard-contratante" : "/dashboard-influenciadora";
  const navType = isContractor ? "contractor" : "influencer";

  if (isLoading) {
    return (
      <MobileLayout title="Campanha" showBack backTo={backTo} navType={navType} showNav={false} showHome homeRoute={backTo}>
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  if (!campaign) {
    return (
      <MobileLayout title="Campanha" showBack backTo={backTo} navType={navType} showNav={false} showHome homeRoute={backTo}>
        <div className="px-6 py-16 text-center">
          <p className="text-muted-foreground">Campanha não encontrada.</p>
        </div>
      </MobileLayout>
    );
  }

  const reqs = (campaign.requirements || {}) as Record<string, unknown>;

  const deadline = (campaign as any)?.apply_deadline ?? null;
  const expired = !isContractor && !!deadline && isExpired(deadline);
  const dLeft = !isContractor && deadline ? daysLeftUTC(deadline) : null;
  const showUrgent = !isContractor && typeof dLeft === "number" && dLeft >= 0 && dLeft <= 2;
  const urgencyLabel = !isContractor && typeof dLeft === "number" ? getUrgencyLabel(dLeft) : null;

  return (
    <MobileLayout title={campaign.title} showBack backTo={backTo} navType={navType} showNav={false} showHome homeRoute={backTo}>
      <div className="px-6 py-6 space-y-4">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
              {campaign.type}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
              {(campaign as any)?.status || "—"}
            </span>

            {!isContractor && showUrgent && urgencyLabel && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-warning/30 bg-warning/10 text-warning font-medium flex items-center gap-1">
                {dLeft === 0 ? <Clock className="w-3 h-3" /> : <Flame className="w-3 h-3" />}
                {urgencyLabel}
              </span>
            )}
          </div>

          <h2 className="font-display text-2xl font-bold text-foreground">{campaign.title}</h2>
        </motion.div>

        {/* Contractor tabs */}
        {isContractor && (
          <div className="flex gap-2">
            <button
              onClick={() => setTab("details")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${
                tab === "details" ? "bg-primary/10 text-primary border border-primary/30" : "bg-card text-muted-foreground border border-border/50"
              }`}
            >
              Detalhes
            </button>

            <button
              onClick={() => setTab("applicants")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                tab === "applicants" ? "bg-primary/10 text-primary border border-primary/30" : "bg-card text-muted-foreground border border-border/50"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Candidaturas ({applicants.length})
            </button>

            <button
              onClick={() => setTab("history")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                tab === "history" ? "bg-primary/10 text-primary border border-primary/30" : "bg-card text-muted-foreground border border-border/50"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Histórico
            </button>
          </div>
        )}

        {/* Details tab */}
        {(tab === "details" || !isContractor) && (
          <>
            {/* Região */}
            <div className="glass-card p-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Região</p>
                  <p className="text-sm font-medium text-foreground">
                    {campaign.city}, {campaign.state}
                  </p>
                </div>
              </div>
            </div>

            {/* Datas destacadas */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/50 bg-card/60 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-accent" />
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Data do evento</p>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {campaign.campaign_date ? formatDateBR(campaign.campaign_date) : "A definir"}
                </p>
              </div>

              <div
                className={`rounded-xl border p-4 ${
                  expired ? "border-destructive/30 bg-destructive/5" : showUrgent ? "border-warning/30 bg-warning/10" : "border-border/50 bg-card/60"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Clock className={`w-4 h-4 ${expired ? "text-destructive" : showUrgent ? "text-warning" : "text-warning"}`} />
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Prazo candidatura</p>
                </div>
                <p className={`text-sm font-semibold ${expired ? "text-destructive" : "text-foreground"}`}>
                  {deadline ? (expired ? "Encerrado" : formatDateBR(deadline)) : "-"}
                </p>
              </div>
            </motion.div>

            {/* Métricas (contractor) */}
            {isContractor && (
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">Métricas</p>
                  </div>
                  <button onClick={fetchMetrics} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                    {metricsLoading ? "Atualizando..." : "Atualizar"}
                  </button>
                </div>

                {metrics ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-border/50 bg-card/60 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Candidaturas</p>
                      <p className="text-lg font-bold text-foreground">{metrics.total_applications}</p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-card/60 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Aprovadas</p>
                      <p className="text-lg font-bold text-foreground">{metrics.accepted_applications}</p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-card/60 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Taxa</p>
                      <p className="text-lg font-bold text-foreground">{metrics.approval_rate}%</p>
                    </div>

                    <div className="col-span-3 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Hourglass className="w-3 h-3 text-warning" /> Pendentes: <b className="text-foreground">{metrics.pending_applications}</b>
                      </span>
                      <span className="flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-muted-foreground" /> Rejeitadas: <b className="text-foreground">{metrics.rejected_applications}</b>
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Métricas indisponíveis no momento.</p>
                )}
              </div>
            )}

            {/* Requirements */}
            {reqs.posts && (
              <div className="glass-card p-4 space-y-2">
                <h4 className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Requisitos</h4>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary">{String(reqs.posts)} post(s)</span>
                  {reqs.format && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent capitalize">{String(reqs.format)}</span>
                  )}
                </div>
              </div>
            )}

            {/* Brief */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-primary" />
                <h4 className="font-semibold text-foreground text-sm">Descrição</h4>
              </div>
              <p className="text-sm text-foreground/70 leading-relaxed glass-card p-4">{campaign.brief_public}</p>
            </div>
          </>
        )}

        {/* Applicants tab */}
        {isContractor && tab === "applicants" && (
          <div className="space-y-3">
            {applicants.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma candidatura ainda.</p>
              </div>
            ) : (
              applicants.map((app) => (
                <motion.div key={app.application_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground text-sm truncate">{app.influencer_name}</h4>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        {app.influencer_instagram && <span>@{app.influencer_instagram.replace("@", "")}</span>}
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" />
                          {app.influencer_city}, {app.influencer_state}
                        </span>
                      </div>
                    </div>
                  </div>

                  {app.status === "pending" && (
                    <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                      <button
                        onClick={() => handleDecide(app.application_id, "rejected")}
                        disabled={updatingId === app.application_id}
                        className="flex-1 py-2.5 rounded-xl border border-border/50 text-muted-foreground font-medium text-xs hover:border-destructive/30 hover:text-destructive disabled:opacity-50"
                      >
                        Recusar
                      </button>
                      <button
                        onClick={() => handleDecide(app.application_id, "accepted")}
                        disabled={updatingId === app.application_id}
                        className="flex-[2] py-2.5 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-xs glow-blue flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {updatingId === app.application_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Aprovar
                      </button>
                    </div>
                  )}

                  {app.status === "accepted" && (
                    <div className="flex items-center gap-2 pt-2 border-t border-border/30 text-accent">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Aprovada</span>
                    </div>
                  )}

                  {app.status === "rejected" && (
                    <div className="flex items-center gap-2 pt-2 border-t border-border/30 text-muted-foreground">
                      <XCircle className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Recusada</span>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* History tab */}
        {tab === "history" && (
          <div className="space-y-3">
            <div className="glass-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Linha do tempo</p>
                  <p className="text-xs text-muted-foreground">Eventos e decisões</p>
                </div>
              </div>

              <button onClick={fetchTimeline} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                {timelineLoading ? "Atualizando..." : "Atualizar"}
              </button>
            </div>

            {timelineLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : timeline.length === 0 ? (
              <div className="py-10 text-center">
                <History className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {timeline.map((ev) => {
                  const Icon = timelineIconFor(ev);

                  const isPositive =
                    ev.event_type === "application.accepted" ||
                    (ev.event_type === "campaign.status_changed" && ev.to_status === "completed");

                  const isNegative =
                    ev.event_type === "application.rejected" ||
                    (ev.event_type === "campaign.status_changed" && (ev.to_status === "deleted" || ev.to_status === "closed_expired"));

                  return (
                    <motion.div key={ev.event_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isPositive ? "bg-accent/10" : isNegative ? "bg-destructive/10" : "bg-primary/10"
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isPositive ? "text-accent" : isNegative ? "text-destructive" : "text-primary"}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{timelineTitleFor(ev)}</p>
                          <p className="text-xs text-muted-foreground mt-1">{timelineSubFor(ev)}</p>

                          {/* micro badge do creator (sempre que existir) */}
                          {(ev.influencer_name || ev.influencer_instagram) && (
                            <div className="mt-2 inline-flex items-center gap-2 text-[10px] px-2 py-1 rounded-full border border-border/50 bg-card/60 text-muted-foreground">
                              <UserIcon className="w-3 h-3" />
                              <span className="truncate">
                                {ev.influencer_name || "Creator"}
                                {normalizeAt(ev.influencer_instagram) ? ` · ${normalizeAt(ev.influencer_instagram)}` : ""}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Influencer apply button */}
      {!isContractor && (
        <div className="sticky bottom-0 px-6 py-4 bg-background/80 backdrop-blur-xl border-t border-border/30">
          {!applicationStatus && (
            <button
              onClick={handleApply}
              disabled={isApplying || expired}
              className="w-full py-4 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-sm glow-blue flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {expired ? "Prazo encerrado" : isApplying ? "Enviando..." : "Quero participar dessa campanha"}
            </button>
          )}

          {applicationStatus === "pending" && (
            <div className="flex items-center justify-center gap-2 py-3 text-warning">
              <Hourglass className="w-4 h-4" />
              <span className="text-sm font-medium">Aguardando aprovação</span>
            </div>
          )}

          {applicationStatus === "accepted" && (
            <button
              onClick={() => navigate(`/campanha-detalhe/${id}`)}
              className="w-full py-4 rounded-xl border border-accent/30 bg-accent/5 text-accent font-semibold text-sm flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Ver detalhes completos
            </button>
          )}

          {applicationStatus === "rejected" && (
            <div className="flex items-center justify-center gap-2 py-3 text-muted-foreground">
              <XCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Não selecionada</span>
            </div>
          )}
        </div>
      )}
    </MobileLayout>
  );
};

export default CampaignView;