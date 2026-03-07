import { useState, useEffect, useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useParams } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import {
  MapPin,
  Calendar,
  FileText,
  Loader2,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  Info,
  ClipboardCheck,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import CreatorDeliverablesPanel from "@/components/campaign/CreatorDeliverablesPanel";

type CampaignRequirements = {
  content_segments?: string[];
  creators_needed?: number | null;
  deliverables?: {
    posts?: number | null;
    format?: string | null;
    caption?: string | null;
    hashtags?: string[];
    mentions?: string[];
    collab?: boolean | null;
    collab_mentions?: string[];
  } | null;
  pricing?: {
    creator_fee?: number | null;
    posts_count?: number | null;
    price_per_post?: number | null;
    currency?: string | null;
  } | null;
  internal?: {
    coupon_code?: string | null;
    quote_total?: number | null;
    quote_subtotal?: number | null;
    quote_discount?: number | null;
    selected_creator_ids?: string[];
  } | null;
};

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
  requirements: CampaignRequirements | null;
  status: string | null;
  created_at: string | null;
  creator_accepted: boolean | null;
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

const formatCurrencyBRL = (value?: number | null) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n);
};

const formatText = (value?: string | null) => {
  if (!value || !String(value).trim()) return "—";
  return String(value).trim();
};

const renderSimpleValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";

  if (typeof value === "boolean") return value ? "Sim" : "Não";

  if (Array.isArray(value)) {
    if (!value.length) return "—";
    return (
      <ul className="mt-1 space-y-1">
        {value.map((item, idx) => (
          <li key={idx} className="text-sm text-foreground/75 leading-relaxed">
            • {String(item)}
          </li>
        ))}
      </ul>
    );
  }

  return String(value);
};

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm text-foreground/80 leading-relaxed">{value}</div>
    </div>
  );
}

function DetailSection({
  title,
  icon,
  description,
  children,
}: {
  title: string;
  icon: ReactNode;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="font-semibold text-foreground text-sm">{title}</h4>
      </div>

      <div className="glass-card p-4">
        {description ? <div className="text-xs text-muted-foreground">{description}</div> : null}
        <div className={description ? "mt-3 space-y-3" : "space-y-3"}>{children}</div>
      </div>
    </div>
  );
}

export default function AcceptedCampaignDetail() {
  const { id } = useParams();
  const { user } = useAuth();

  const [campaign, setCampaign] = useState<CampaignDetailForCreator | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [tab, setTab] = useState<"details" | "deliverables">("details");

  const fetchDetail = async () => {
    if (!id || !user) return;

    setIsLoading(true);

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

    const { error } = await supabase.rpc("creator_accept_campaign" as any, {
      p_campaign_id: id,
    });

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

  const locationLabel = useMemo(() => {
    if (!campaign) return "";
    const parts = [campaign.city, campaign.state].filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
  }, [campaign]);

  const typeLabel = useMemo(() => {
    const raw = campaign?.type?.trim();
    if (!raw) return "campanha";
    return raw;
  }, [campaign]);

  const contentSegments = campaign?.requirements?.content_segments ?? [];
  const creatorsNeeded = campaign?.requirements?.creators_needed ?? null;
  const deliverables = campaign?.requirements?.deliverables ?? null;
  const pricing = campaign?.requirements?.pricing ?? null;

  if (isLoading) {
    return (
      <MobileLayout
        title="Campanha"
        showBack
        backTo="/dashboard-influenciadora"
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
        backTo="/dashboard-influenciadora"
        navType="influencer"
        showNav={false}
        showHome
        homeRoute="/dashboard-influenciadora"
      >
        <div className="px-6 py-16 text-center">
          <p className="text-muted-foreground">Campanha não encontrada ou acesso não autorizado.</p>
        </div>
      </MobileLayout>
    );
  }

  const isCompleted = campaign.status === "completed";
  const creatorAccepted = !!campaign.creator_accepted;

  return (
    <MobileLayout
      title={isCompleted ? "Campanha concluída" : "Campanha"}
      showBack
      backTo="/dashboard-influenciadora"
      navType="influencer"
      showNav={false}
      showHome
      homeRoute="/dashboard-influenciadora"
    >
      <div className="px-6 py-6 space-y-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
              {typeLabel}
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
          <p className="text-xs text-muted-foreground mt-1">
            Revise os detalhes e acompanhe o status da sua entrega.
          </p>
        </motion.div>

        <div className="glass-card p-2 flex items-center gap-2">
          <button
            onClick={() => setTab("details")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              tab === "details"
                ? "bg-primary/12 text-primary border border-primary/25"
                : "bg-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Detalhes
          </button>

          <button
            onClick={() => setTab("deliverables")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              tab === "deliverables"
                ? "bg-primary/12 text-primary border border-primary/25"
                : "bg-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            Entregas
          </button>
        </div>

        {tab === "deliverables" ? (
          <CreatorDeliverablesPanel campaignId={campaign.id} creatorAccepted={creatorAccepted} />
        ) : (
          <>
            <div className="glass-card p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Região</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{locationLabel}</p>
                  {!!campaign.region && <p className="text-xs text-muted-foreground mt-1">Área: {campaign.region}</p>}
                </div>
              </div>
            </div>

            <div className="glass-card p-4 border border-accent/15">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-accent" />
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Data do evento</p>
                  <p className="text-sm font-semibold text-foreground mt-1">
                    {campaign.campaign_date ? formatDateBR(campaign.campaign_date) : "A definir"}
                  </p>
                </div>
              </div>
            </div>

            {!!campaign.brief_public && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold text-foreground text-sm">Objetivos da campanha</h4>
                </div>
                <div className="glass-card p-4">
                  <p className="text-sm text-foreground/75 leading-relaxed whitespace-pre-line">{campaign.brief_public}</p>
                </div>
              </div>
            )}

            {creatorAccepted && !!campaign.brief_private && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-accent" />
                  <h4 className="font-semibold text-foreground text-sm">Briefing completo</h4>
                </div>
                <div className="glass-card p-4 border border-accent/15">
                  <p className="text-sm text-foreground/75 leading-relaxed whitespace-pre-line">{campaign.brief_private}</p>
                </div>
              </div>
            )}

            <DetailSection
              title="Requisitos"
              icon={<ClipboardList className="w-4 h-4 text-primary" />}
              description="Confira os critérios definidos para esta campanha."
            >
              <DetailRow label="Segmentos de conteúdo" value={renderSimpleValue(contentSegments)} />
              <DetailRow label="Creators necessários" value={renderSimpleValue(creatorsNeeded)} />
            </DetailSection>

            <DetailSection
              title="Entregas combinadas"
              icon={<ClipboardCheck className="w-4 h-4 text-accent" />}
              description="Veja abaixo o que precisa ser entregue nesta campanha."
            >
              <DetailRow label="Quantidade de posts" value={renderSimpleValue(deliverables?.posts)} />
              <DetailRow label="Formato do conteúdo" value={renderSimpleValue(deliverables?.format)} />
              <DetailRow label="Legenda obrigatória" value={formatText(deliverables?.caption)} />
              <DetailRow label="Hashtags" value={renderSimpleValue(deliverables?.hashtags)} />
              <DetailRow label="Perfis para marcar" value={renderSimpleValue(deliverables?.mentions)} />
              <DetailRow label="Post em collab" value={renderSimpleValue(deliverables?.collab)} />
              <DetailRow label="Perfis da collab" value={renderSimpleValue(deliverables?.collab_mentions)} />
            </DetailSection>

            <DetailSection
              title="Valores da sua participação"
              icon={<Wallet className="w-4 h-4 text-primary" />}
              description="Aqui aparecem apenas os valores individuais da sua participação nesta campanha."
            >
              <DetailRow label="Valor total a receber" value={formatCurrencyBRL(pricing?.creator_fee)} />
              <DetailRow label="Quantidade de posts" value={renderSimpleValue(pricing?.posts_count)} />
              <DetailRow label="Valor por post" value={formatCurrencyBRL(pricing?.price_per_post)} />
              <DetailRow label="Moeda" value={renderSimpleValue(pricing?.currency || "BRL")} />
            </DetailSection>

            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Informações</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border/50 bg-card/60 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Criada em</div>
                  <div className="mt-1 text-sm text-foreground/80">
                    {campaign.created_at ? formatDateBR(campaign.created_at) : "—"}
                  </div>
                </div>

                <div className="rounded-xl border border-border/50 bg-card/60 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">ID</div>
                  <div className="mt-1 text-xs text-foreground/70 truncate" title={campaign.id}>
                    {campaign.id}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

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