import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import { MapPin, Calendar, FileText, Loader2, BadgeCheck, CheckCircle2, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import CampaignFilesTab from "@/components/campaign/CampaignFilesTab";

type CampaignDetailForCreator = {
  id: string;
  title: string;
  type: string | null;
  region: string | null;
  state: string | null;
  city: string | null;
  campaign_date: string | null;
  brief_public: string | null;
  brief_private: string | null;
  requirements: Record<string, any> | null;
  status: string | null; // active | completed | deleted | etc
  created_at: string | null;

  // importante para o fluxo:
  creator_accepted: boolean | null; // <- faça a RPC retornar isso
};

const formatDateBR = (value?: string | null) => {
  if (!value) return "-";
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = isDateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return isDateOnly ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : d.toLocaleDateString("pt-BR");
};

export default function AcceptedCampaignDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();

  const [campaign, setCampaign] = useState<CampaignDetailForCreator | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  // aba simples (detalhes / arquivos)
  const [tab, setTab] = useState<"details" | "files">("details");

  const fetchDetail = async () => {
    if (!id || !user) return;

    setIsLoading(true);

    // ✅ detalhe fechado para creator selecionado
    const { data, error } = await supabase.rpc("get_campaign_detail_for_creator" as any, {
      p_campaign_id: id,
    });

    if (error) {
      console.error("GET_CAMPAIGN_DETAIL_FOR_CREATOR_ERROR", error);
      setCampaign(null);
      setIsLoading(false);
      return;
    }

    const row = Array.isArray(data) ? (data[0] as any) : (data as any);
    if (!row || row.status === "deleted") {
      setCampaign(null);
      setIsLoading(false);
      return;
    }

    setCampaign(row as CampaignDetailForCreator);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  const handleAccept = async () => {
    if (!id) return;

    setAccepting(true);

    const { error } = await supabase.rpc("creator_accept_campaign" as any, { p_campaign_id: id });

    if (error) {
      console.error("CREATOR_ACCEPT_CAMPAIGN_ERROR", error);
      toast.error("Não foi possível confirmar participação.");
      setAccepting(false);
      return;
    }

    toast.success("Participação confirmada!");
    setAccepting(false);
    await fetchDetail();
  };

  if (isLoading) {
    return (
      <MobileLayout title="Campanha" showBack backTo="/dashboard-influenciadora" navType="influencer" showNav={false} showHome homeRoute="/dashboard-influenciadora">
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  if (!campaign) {
    return (
      <MobileLayout title="Campanha" showBack backTo="/dashboard-influenciadora" navType="influencer" showNav={false} showHome homeRoute="/dashboard-influenciadora">
        <div className="px-6 py-16 text-center">
          <p className="text-muted-foreground">Campanha não encontrada ou acesso não autorizado.</p>
        </div>
      </MobileLayout>
    );
  }

  const isCompleted = campaign.status === "completed";
  const creatorAccepted = !!campaign.creator_accepted;

  return (
    <MobileLayout title={isCompleted ? "Campanha concluída" : "Campanha"} showBack backTo="/dashboard-influenciadora" navType="influencer" showNav={false} showHome homeRoute="/dashboard-influenciadora">
      <div className="px-6 py-6 space-y-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
              {campaign.type || "campanha"}
            </span>

            {isCompleted ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-accent/50 bg-accent/15 text-accent font-medium flex items-center gap-1">
                <BadgeCheck className="w-3 h-3" />
                Concluída
              </span>
            ) : creatorAccepted ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-accent/40 bg-accent/10 text-accent font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Participação confirmada
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-warning/40 bg-warning/10 text-warning font-medium">
                Aguardando sua confirmação
              </span>
            )}
          </div>

          <h2 className="font-display text-2xl font-bold text-foreground">{campaign.title}</h2>
        </motion.div>

        {/* Tabs simples */}
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
            onClick={() => setTab("files")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              tab === "files" ? "bg-primary/10 text-primary border border-primary/30" : "bg-card text-muted-foreground border border-border/50"
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            Arquivos
          </button>
        </div>

        {tab === "files" ? (
          <CampaignFilesTab campaignId={campaign.id} role="influencer" influencerAccepted={creatorAccepted} />
        ) : (
          <>
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

            <div className="rounded-xl border border-border/50 bg-card/60 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-accent" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Data do evento</p>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {campaign.campaign_date ? formatDateBR(campaign.campaign_date) : "A definir"}
              </p>
            </div>

            {!!campaign.brief_public && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold text-foreground text-sm">Descrição</h4>
                </div>
                <p className="text-sm text-foreground/70 leading-relaxed glass-card p-4">{campaign.brief_public}</p>
              </div>
            )}

            {!!campaign.brief_private && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-accent" />
                  <h4 className="font-semibold text-foreground text-sm">Briefing completo</h4>
                </div>
                <p className="text-sm text-foreground/70 leading-relaxed glass-card p-4 border-accent/20">{campaign.brief_private}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* CTA: Aceitar participar (só se ativa e ainda não aceitou) */}
      {!isCompleted && tab === "details" && !creatorAccepted && (
        <div className="sticky bottom-0 px-6 py-4 bg-background/80 backdrop-blur-xl border-t border-border/30">
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full py-4 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-sm glow-blue flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {accepting ? "Confirmando..." : "Aceitar participar"}
          </button>
        </div>
      )}
    </MobileLayout>
  );
}