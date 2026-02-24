import { useState, useEffect } from "react";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { PublicCampaignFeed, CampaignApplicant } from "@/types/database";

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
  const [tab, setTab] = useState<"details" | "applicants">("details");

  const isContractor = userRole === "contractor";

  // ✅ Formata datas para pt-BR (DD/MM/AAAA) sem bug de fuso em YYYY-MM-DD
  const formatDateBR = (value?: string | null) => {
    if (!value) return "-";

    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const d = isDateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);

    if (Number.isNaN(d.getTime())) return "-";

    return isDateOnly
      ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" })
      : d.toLocaleDateString("pt-BR");
  };

  useEffect(() => {
    const fetchData = async () => {
      // ✅ Evita loading infinito quando params/auth ainda não carregaram
      if (!id || !user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        if (isContractor) {
          // ✅ Contractor: fetch own campaign + applicants (com segurança)
          const { data: campaignData, error: campaignError } = await supabase
            .from("campaigns")
            .select("*")
            .eq("id", id)
            .eq("created_by", user.id)
            .maybeSingle();

          if (campaignError) {
            console.error("CAMPAIGNVIEW_CONTRACTOR_FETCH_ERROR", campaignError);
          }

          setCampaign((campaignData ?? null) as unknown as PublicCampaignFeed);

          const { data: applicantData, error: applicantsError } = await supabase.rpc(
            "get_campaign_applicants" as any,
            { p_campaign_id: id }
          );

          if (applicantsError) {
            console.error("CAMPAIGNVIEW_APPLICANTS_ERROR", applicantsError);
          }

          setApplicants((applicantData || []) as unknown as CampaignApplicant[]);
        } else {
          // Influencer: fetch from public feed
          const { data: feedData, error: feedError } = await supabase.rpc(
            "get_campaigns_public_feed" as any
          );

          if (feedError) {
            console.error("CAMPAIGNVIEW_PUBLIC_FEED_ERROR", feedError);
          }

          const found = ((feedData || []) as unknown as PublicCampaignFeed[]).find(
            (c) => c.id === id
          );
          setCampaign(found || null);

          // Check if already applied
          const { data: appData, error: appError } = await supabase
            .from("campaign_applications")
            .select("status")
            .eq("campaign_id", id)
            .eq("influencer_id", user.id)
            .maybeSingle();

          if (appError) {
            console.error("CAMPAIGNVIEW_APPLICATION_STATUS_ERROR", appError);
          }

          if (appData) {
            setApplicationStatus((appData as any).status);
          }
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
  }, [id, user, isContractor]);

  const handleApply = async () => {
    if (!id || !user) return;
    setIsApplying(true);

    const { error } = await supabase.rpc("apply_to_campaign" as any, {
      p_campaign_id: id,
    });

    if (error) {
      console.error("Apply error:", error);
      toast.error("Erro ao se candidatar.");
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

      // Refresh applicants
      const { data: applicantData, error: applicantsError } = await supabase.rpc(
        "get_campaign_applicants" as any,
        { p_campaign_id: id }
      );

      if (applicantsError) {
        console.error("CAMPAIGNVIEW_APPLICANTS_REFRESH_ERROR", applicantsError);
      }

      setApplicants((applicantData || []) as unknown as CampaignApplicant[]);
    }
    setUpdatingId(null);
  };

  const backTo = isContractor ? "/dashboard-contratante" : "/dashboard-influenciadora";
  const navType = isContractor ? "contractor" : "influencer";

  if (isLoading) {
    return (
      <MobileLayout
        title="Campanha"
        showBack
        backTo={backTo}
        navType={navType}
        showNav={false}
        showHome
        homeRoute={backTo}
      >
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  if (!campaign) {
    return (
      <MobileLayout
        title="Campanha"
        showBack
        backTo={backTo}
        navType={navType}
        showNav={false}
        showHome
        homeRoute={backTo}
      >
        <div className="px-6 py-16 text-center">
          <p className="text-muted-foreground">Campanha não encontrada.</p>
        </div>
      </MobileLayout>
    );
  }

  const reqs = (campaign.requirements || {}) as Record<string, unknown>;

  return (
    <MobileLayout
      title={campaign.title}
      showBack
      backTo={backTo}
      navType={navType}
      showNav={false}
      showHome
      homeRoute={backTo}
    >
      <div className="px-6 py-6 space-y-4">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
              {campaign.type}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
              {campaign.status}
            </span>
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground">{campaign.title}</h2>
        </motion.div>

        {/* Contractor tabs */}
        {isContractor && (
          <div className="flex gap-2">
            <button
              onClick={() => setTab("details")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${
                tab === "details"
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-card text-muted-foreground border border-border/50"
              }`}
            >
              Detalhes
            </button>
            <button
              onClick={() => setTab("applicants")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                tab === "applicants"
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-card text-muted-foreground border border-border/50"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Candidaturas ({applicants.length})
            </button>
          </div>
        )}

        {/* Details tab */}
        {(tab === "details" || !isContractor) && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 gap-3"
            >
              <div className="glass-card p-4">
                <MapPin className="w-4 h-4 text-primary mb-2" />
                <p className="text-xs text-muted-foreground">Região</p>
                <p className="text-sm font-medium text-foreground">
                  {campaign.city}, {campaign.state}
                </p>
              </div>
              <div className="glass-card p-4">
                <Calendar className="w-4 h-4 text-accent mb-2" />
                <p className="text-xs text-muted-foreground">Data</p>
                <p className="text-sm font-medium text-foreground">
                  {campaign.campaign_date ? formatDateBR(campaign.campaign_date) : "A definir"}
                </p>
              </div>
            </motion.div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-warning" />
                <span className="text-xs text-muted-foreground">Prazo para candidatura</span>
              </div>
              <p className="text-sm font-medium text-foreground">{formatDateBR(campaign.apply_deadline)}</p>
            </div>

            {/* Requirements */}
            {reqs.posts && (
              <div className="glass-card p-4 space-y-2">
                <h4 className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Requisitos
                </h4>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                    {String(reqs.posts)} post(s)
                  </span>
                  {reqs.format && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent capitalize">
                      {String(reqs.format)}
                    </span>
                  )}
                </div>
                {Array.isArray(reqs.hashtags) && (reqs.hashtags as string[]).length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {(reqs.hashtags as string[]).join(" ")}
                  </p>
                )}
                {Array.isArray(reqs.mentions) && (reqs.mentions as string[]).length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {(reqs.mentions as string[]).join(" ")}
                  </p>
                )}
              </div>
            )}

            {/* Brief */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-primary" />
                <h4 className="font-semibold text-foreground text-sm">Descrição</h4>
              </div>
              <p className="text-sm text-foreground/70 leading-relaxed glass-card p-4">
                {campaign.brief_public}
              </p>
            </div>
          </>
        )}

        {/* Applicants tab (contractor) */}
        {isContractor && tab === "applicants" && (
          <div className="space-y-3">
            {applicants.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma candidatura ainda.</p>
              </div>
            ) : (
              applicants.map((app) => (
                <motion.div
                  key={app.application_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-4 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground text-sm truncate">
                        {app.influencer_name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        {app.influencer_instagram && (
                          <span>@{app.influencer_instagram.replace("@", "")}</span>
                        )}
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" />
                          {app.influencer_city}, {app.influencer_state}
                        </span>
                      </div>
                      {app.influencer_followers && (
                        <span className="text-[10px] text-muted-foreground">
                          {app.influencer_followers} seguidores
                        </span>
                      )}
                      {app.note && (
                        <p className="text-xs text-foreground/60 mt-1 italic">"{app.note}"</p>
                      )}
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
                        {updatingId === app.application_id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
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
      </div>

      {/* Influencer apply button */}
      {!isContractor && (
        <div className="sticky bottom-0 px-6 py-4 bg-background/80 backdrop-blur-xl border-t border-border/30">
          {!applicationStatus && (
            <button
              onClick={handleApply}
              disabled={isApplying}
              className="w-full py-4 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-sm glow-blue flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isApplying ? "Enviando..." : "Quero participar dessa campanha"}
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