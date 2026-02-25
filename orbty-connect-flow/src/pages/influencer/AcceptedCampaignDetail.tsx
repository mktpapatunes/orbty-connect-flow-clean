import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import {
  MapPin,
  Calendar,
  FileText,
  CheckCircle2,
  Download,
  Loader2,
  Info,
  Clock,
  BadgeCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { CampaignAsset } from "@/types/database";

interface CampaignDetail {
  id: string;
  title: string;
  type: string;
  region: string;
  state: string;
  city: string;
  campaign_date: string | null;
  apply_deadline: string;
  brief_public: string;
  brief_private: string | null;
  requirements: Record<string, unknown>;
  status: string;
  created_at: string;
}

/* =========================
   Utils
========================= */

const formatDateBR = (value?: string | null) => {
  if (!value) return "-";

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = isDateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);

  if (Number.isNaN(d.getTime())) return "-";

  return isDateOnly
    ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : d.toLocaleDateString("pt-BR");
};

const AcceptedCampaignDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [assets, setAssets] = useState<CampaignAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!id || !user) return;

      const { data, error } = await supabase.rpc("get_campaign_detail_if_accepted" as any, {
        p_campaign_id: id,
      });

      if (!error && data && (data as any[]).length > 0) {
        setCampaign((data as any[])[0] as CampaignDetail);
      }

      const { data: assetData } = await supabase
        .from("campaign_assets")
        .select("*")
        .eq("campaign_id", id);

      if (assetData) {
        setAssets(assetData as unknown as CampaignAsset[]);
      }

      setIsLoading(false);
    };

    fetchDetail();
  }, [id, user]);

  const handleDownload = async (path: string, label: string | null) => {
    const { data, error } = await supabase.storage
      .from("campaign-assets")
      .createSignedUrl(path, 300);

    if (error || !data?.signedUrl) {
      console.error("Error creating signed URL:", error);
      return;
    }

    window.open(data.signedUrl, "_blank");
  };

  if (isLoading) {
    return (
      <MobileLayout
        title="Campanha"
        showBack
        backTo="/minhas-candidaturas"
        navType="influencer"
        showNav={false}
        showHome
        homeRoute="/dashboard-influenciadora"
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
        backTo="/minhas-candidaturas"
        navType="influencer"
        showNav={false}
        showHome
        homeRoute="/dashboard-influenciadora"
      >
        <div className="px-6 py-16 text-center">
          <p className="text-muted-foreground">Campanha não encontrada ou acesso não autorizado.</p>
          <button
            onClick={() => navigate("/dashboard-influenciadora")}
            className="mt-4 text-sm text-primary font-medium"
          >
            Voltar ao painel
          </button>
        </div>
      </MobileLayout>
    );
  }

  const reqs = campaign.requirements || {};
  const isCompleted = campaign.status === "completed";

  return (
    <MobileLayout
      title={isCompleted ? "Campanha concluída" : "Campanha aceita"}
      showBack
      backTo="/minhas-candidaturas"
      navType="influencer"
      showNav={false}
      showHome
      homeRoute="/dashboard-influenciadora"
    >
      <div className="px-6 py-6 space-y-5">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
              {campaign.type}
            </span>

            {isCompleted && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-accent/50 bg-accent/15 text-accent font-medium flex items-center gap-1">
                <BadgeCheck className="w-3 h-3" />
                Concluída
              </span>
            )}
          </div>

          <h2 className="font-display text-2xl font-bold text-foreground">
            {campaign.title}
          </h2>
        </motion.div>

        {/* Status principal */}
        <div className="glass-card p-3 flex items-center gap-3 border-accent/40 bg-accent/5">
          {isCompleted ? (
            <BadgeCheck className="w-4 h-4 text-accent shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
          )}

          <span className="text-xs text-accent font-medium">
            {isCompleted
              ? "Campanha concluída com sucesso"
              : "Você foi aprovada para esta campanha"}
          </span>
        </div>

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

        {/* Datas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/50 bg-card/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-accent" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Data do evento
              </p>
            </div>
            <p className="text-sm font-semibold text-foreground">
              {campaign.campaign_date
                ? formatDateBR(campaign.campaign_date)
                : "A definir"}
            </p>
          </div>

          <div className="rounded-xl border border-border/50 bg-card/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-warning" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Prazo candidatura
              </p>
            </div>
            <p className="text-sm font-semibold text-foreground">
              {formatDateBR(campaign.apply_deadline)}
            </p>
          </div>
        </div>

        {/* Brief */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-foreground text-sm">
              Descrição pública
            </h4>
          </div>
          <p className="text-sm text-foreground/70 leading-relaxed glass-card p-4">
            {campaign.brief_public}
          </p>
        </div>

        {campaign.brief_private && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-accent" />
              <h4 className="font-semibold text-foreground text-sm">
                Briefing privado
              </h4>
            </div>
            <p className="text-sm text-foreground/70 leading-relaxed glass-card p-4 border-accent/20">
              {campaign.brief_private}
            </p>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 px-6 py-4 bg-background/80 backdrop-blur-xl border-t border-border/30">
        <button
          onClick={() => navigate("/dashboard-influenciadora")}
          className="w-full py-4 rounded-xl border border-border/50 text-muted-foreground font-medium text-sm hover:text-foreground transition-colors"
        >
          Voltar ao painel
        </button>
      </div>
    </MobileLayout>
  );
};

export default AcceptedCampaignDetail;