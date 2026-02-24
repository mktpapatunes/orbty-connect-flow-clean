import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import { MapPin, Calendar, FileText, CheckCircle2, Download, Loader2, Info } from "lucide-react";
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

const AcceptedCampaignDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [assets, setAssets] = useState<CampaignAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    const fetchDetail = async () => {
      if (!id || !user) return;

      const { data, error } = await supabase.rpc("get_campaign_detail_if_accepted" as any, {
        p_campaign_id: id,
      });

      if (!error && data && (data as any[]).length > 0) {
        setCampaign((data as any[])[0] as CampaignDetail);
      }

      // Fetch assets
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
      <MobileLayout title="Campanha" showBack backTo="/minhas-candidaturas" navType="influencer" showNav={false} showHome homeRoute="/dashboard-influenciadora">
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  if (!campaign) {
    return (
      <MobileLayout title="Campanha" showBack backTo="/minhas-candidaturas" navType="influencer" showNav={false} showHome homeRoute="/dashboard-influenciadora">
        <div className="px-6 py-16 text-center">
          <p className="text-muted-foreground">Campanha não encontrada ou acesso não autorizado.</p>
          <button onClick={() => navigate("/dashboard-influenciadora")} className="mt-4 text-sm text-primary font-medium">
            Voltar ao painel
          </button>
        </div>
      </MobileLayout>
    );
  }

  const reqs = campaign.requirements || {};

  return (
    <MobileLayout title="Campanha aceita" showBack backTo="/minhas-candidaturas" navType="influencer" showNav={false} showHome homeRoute="/dashboard-influenciadora">
      <div className="px-6 py-6 space-y-5">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">{campaign.type}</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground">{campaign.title}</h2>
        </motion.div>

        {/* Accepted badge */}
        <div className="glass-card p-3 flex items-center gap-3 border-accent/30">
          <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
          <span className="text-xs text-accent font-medium">Você foi aprovada para esta campanha</span>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card p-4">
            <MapPin className="w-4 h-4 text-primary mb-2" />
            <p className="text-xs text-muted-foreground">Região</p>
            <p className="text-sm font-medium text-foreground">{campaign.city}, {campaign.state}</p>
          </div>
          <div className="glass-card p-4">
            <Calendar className="w-4 h-4 text-accent mb-2" />
            <p className="text-xs text-muted-foreground">Data</p>
            <p className="text-sm font-medium text-foreground">
              {campaign.campaign_date ? formatDateBR(campaign.campaign_date) : "A definir"}
            </p>
          </div>
        </div>

        {/* Requirements */}
        {reqs.posts && (
          <div className="glass-card p-4 space-y-2">
            <h4 className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Requisitos</h4>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary">{String(reqs.posts)} post(s)</span>
              {reqs.format && <span className="text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent capitalize">{String(reqs.format)}</span>}
            </div>
            {Array.isArray(reqs.hashtags) && (reqs.hashtags as string[]).length > 0 && (
              <p className="text-xs text-muted-foreground">{(reqs.hashtags as string[]).join(" ")}</p>
            )}
          </div>
        )}

        {/* Public brief */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-foreground text-sm">Descrição pública</h4>
          </div>
          <p className="text-sm text-foreground/70 leading-relaxed glass-card p-4">{campaign.brief_public}</p>
        </div>

        {/* Private brief */}
        {campaign.brief_private && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-accent" />
              <h4 className="font-semibold text-foreground text-sm">Briefing privado</h4>
            </div>
            <p className="text-sm text-foreground/70 leading-relaxed glass-card p-4 border-accent/20">{campaign.brief_private}</p>
          </div>
        )}

        {/* Assets */}
        {assets.length > 0 && (
          <div>
            <h4 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" />
              Arquivos da campanha
            </h4>
            <div className="space-y-2">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => handleDownload(asset.path, asset.label)}
                  className="w-full glass-card-hover p-3 flex items-center gap-3 text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground font-medium truncate">{asset.label || asset.path}</p>
                    {asset.size && <p className="text-[10px] text-muted-foreground">{(asset.size / 1024).toFixed(0)} KB</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="glass-card p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Você foi aprovada! Siga o briefing e publique na data indicada.
          </p>
        </div>
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