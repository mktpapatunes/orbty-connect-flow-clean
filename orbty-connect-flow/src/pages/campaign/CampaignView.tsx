import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import {
  MapPin,
  Calendar,
  FileText,
  Loader2,
  CheckCircle2,
  Paperclip,
  ClipboardList,
  Info,
  Sparkles,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { PublicCampaignFeed } from "@/types/database";
import CampaignFilesTab from "@/components/campaign/CampaignFilesTab";
import { toast } from "sonner";

type TabKey = "details" | "files";
type ParticipantStatus = "invited" | "confirmed" | "delivered" | "approved";

const formatDateBR = (value?: string | null) => {
  if (!value) return "-";
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = isDateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return isDateOnly ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : d.toLocaleDateString("pt-BR");
};

const humanizeKey = (key: string) => {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const renderValue = (v: any): any => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;

  if (Array.isArray(v)) {
    if (v.length === 0) return "—";
    return (
      <ul className="mt-1 space-y-1">
        {v.map((item, idx) => (
          <li key={idx} className="text-sm text-foreground/75 leading-relaxed">
            • {typeof item === "string" || typeof item === "number" ? String(item) : JSON.stringify(item)}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof v === "object") {
    const entries = Object.entries(v);
    if (entries.length === 0) return "—";
    return (
      <div className="mt-2 grid grid-cols-1 gap-2">
        {entries.map(([k, val]) => (
          <div key={k} className="rounded-xl border border-border/50 bg-card/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{humanizeKey(k)}</div>
            <div className="mt-1 text-sm text-foreground/80 leading-relaxed">{renderValue(val)}</div>
          </div>
        ))}
      </div>
    );
  }

  return String(v);
};

const statusLabel = (s?: string | null) => {
  if (!s) return "—";
  if (s === "active") return "Ativa";
  if (s === "closed_manual") return "Encerrada (manual)";
  if (s === "closed_expired") return "Encerrada (prazo)";
  if (s === "completed") return "Concluída";
  if (s === "deleted") return "Excluída";
  if (s === "draft") return "Rascunho";
  return s;
};

const getInvitedSummary = (req?: Record<string, any> | null) => {
  const posts = typeof req?.posts === "number" ? req.posts : req?.posts ? Number(req.posts) : undefined;
  const format = typeof req?.format === "string" ? req.format : undefined;

  const creatorsNeeded =
    typeof req?.creators_needed === "number"
      ? req.creators_needed
      : req?.creators_needed
        ? Number(req.creators_needed)
        : undefined;

  const segments = Array.isArray(req?.content_segments)
    ? req.content_segments.filter((x: any) => typeof x === "string" && x.trim().length > 0)
    : [];

  return { posts, format, creatorsNeeded, segments };
};

const CampaignView = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { user, userRole, authReady } = useAuth();

  const [campaign, setCampaign] = useState<PublicCampaignFeed | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("details");

  const [myParticipationStatus, setMyParticipationStatus] = useState<ParticipantStatus | null>(null);
  const [confirming, setConfirming] = useState(false);

  const isContractor = userRole === "contractor";
  const isInfluencer = userRole === "influencer";

  const setTabWithUrl = useCallback(
    (next: TabKey) => {
      setTab(next);
      const sp = new URLSearchParams(location.search);
      sp.set("tab", next);
      navigate({ pathname: location.pathname, search: sp.toString() }, { replace: true });
    },
    [location.pathname, location.search, navigate]
  );

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const t = sp.get("tab");
    const allowed: TabKey[] = ["details", "files"];
    if (t && allowed.includes(t as TabKey)) {
      const next = t as TabKey;
      if (tab !== next) setTab(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const confirmParticipation = useCallback(async () => {
    if (!id || !user) return;
    if (!isInfluencer) return;

    setConfirming(true);
    try {
      const { error } = await supabase
        .from("campaign_participants")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
        })
        .eq("campaign_id", id)
        .eq("influencer_id", user.id);

      if (error) {
        console.error("CONFIRM_PARTICIPATION_ERROR", error);
        toast.error(error.message || "Não foi possível confirmar sua participação.");
        return;
      }

      toast.success("Participação confirmada!");
      setMyParticipationStatus("confirmed");
      navigate(`/campanha-detalhe/${id}`, { replace: true });
    } catch (e: any) {
      console.error("CONFIRM_PARTICIPATION_EXCEPTION", e);
      toast.error(e?.message || "Erro ao confirmar participação.");
    } finally {
      setConfirming(false);
    }
  }, [id, user, isInfluencer, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!authReady || userRole === undefined) return;

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
            .neq("status", "deleted")
            .maybeSingle();

          if (campaignError) console.error("CAMPAIGNVIEW_CONTRACTOR_FETCH_ERROR", campaignError);

          setCampaign((campaignData ?? null) as unknown as PublicCampaignFeed);
          setMyParticipationStatus(null);
          return;
        }

        // influencer
        const { data: cp, error: cpErr } = await supabase
          .from("campaign_participants")
          .select("status")
          .eq("campaign_id", id)
          .eq("influencer_id", user.id)
          .maybeSingle();

        if (cpErr) console.error("CAMPAIGNVIEW_INFLUENCER_CP_ERROR", cpErr);

        if (!cp) {
          setCampaign(null);
          setMyParticipationStatus(null);
          return;
        }

        const pStatus = (cp.status as ParticipantStatus) || null;
        setMyParticipationStatus(pStatus);

        if (pStatus && pStatus !== "invited") {
          navigate(`/campanha-detalhe/${id}`, { replace: true });
          return;
        }

        const { data: campaignData, error: campaignError } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", id)
          .neq("status", "deleted")
          .maybeSingle();

        if (campaignError) console.error("CAMPAIGNVIEW_INFLUENCER_FETCH_ERROR", campaignError);

        setCampaign((campaignData ?? null) as unknown as PublicCampaignFeed);
      } catch (e) {
        console.error("CAMPAIGNVIEW_UNEXPECTED_ERROR", e);
        setCampaign(null);
        setMyParticipationStatus(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [authReady, userRole, id, user, isContractor, isInfluencer, navigate]);

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

  const shouldShowInfluencerConfirmCta = isInfluencer && myParticipationStatus === "invited";
  const isInvitedInfluencer = isInfluencer && myParticipationStatus === "invited";

  const status = (campaign as any)?.status as string | null;
  const region = ((campaign as any)?.region as string | null) ?? null;
  const campaignDate = ((campaign as any)?.campaign_date as string | null) ?? null;

  const briefPublic = ((campaign as any)?.brief_public as string | null) ?? null;
  const briefPrivate = ((campaign as any)?.brief_private as string | null) ?? null;
  const requirements = ((campaign as any)?.requirements as Record<string, any> | null) ?? null;

  const invitedSummary = getInvitedSummary(requirements);

  const city = ((campaign as any)?.city as string | null) ?? null;
  const state = ((campaign as any)?.state as string | null) ?? null;
  const locationLabel = [city, state].filter(Boolean).join(", ") || "—";

  return (
    <MobileLayout title={campaign.title} showBack backTo={backTo} navType={navType} showNav={false} showHome homeRoute={backTo}>
      <div className="px-6 py-6 space-y-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
              {(campaign as any)?.type || "campanha"}
            </span>

            {status && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-card/60 text-muted-foreground font-medium">
                {statusLabel(status)}
              </span>
            )}

            {isInvitedInfluencer && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-warning/40 bg-warning/10 text-warning font-medium">
                Convite pendente
              </span>
            )}
          </div>

          <h2 className="font-display text-2xl font-bold text-foreground">{campaign.title}</h2>

          {isInvitedInfluencer ? (
            <p className="text-xs text-muted-foreground mt-1">
              Veja um resumo da campanha. Ao confirmar participação, você libera briefing completo, instruções e arquivos.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Detalhes completos da campanha.</p>
          )}

          {shouldShowInfluencerConfirmCta && (
            <div className="mt-4">
              <button
                type="button"
                onClick={confirmParticipation}
                disabled={confirming}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                  confirming ? "bg-secondary text-muted-foreground" : "bg-gradient-neon text-primary-foreground glow-blue"
                }`}
              >
                {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {confirming ? "Confirmando..." : "Confirmar participação"}
              </button>

              <p className="text-[11px] text-muted-foreground mt-2">
                Ao confirmar, você libera instruções completas (legenda, hashtags, menções) e pode enviar suas entregas.
              </p>
            </div>
          )}
        </motion.div>

        {/* Tabs só para contractor; invited NÃO vê arquivos */}
        {isContractor && (
          <div className="glass-card p-2 flex items-center gap-2">
            <button
              onClick={() => setTabWithUrl("details")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                tab === "details"
                  ? "bg-primary/12 text-primary border border-primary/25"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Detalhes
            </button>

            <button
              onClick={() => setTabWithUrl("files")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                tab === "files"
                  ? "bg-primary/12 text-primary border border-primary/25"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Paperclip className="w-3.5 h-3.5" />
              Arquivos
            </button>
          </div>
        )}

        {isContractor && tab === "files" && (
          <CampaignFilesTab campaignId={String(id)} role="contractor" influencerAccepted={false} />
        )}

        {tab === "details" && (
          <>
            <div className="glass-card p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Região</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{locationLabel}</p>
                  {!!region && <p className="text-xs text-muted-foreground mt-1">Área: {region}</p>}
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
                  <p className="text-sm font-semibold text-foreground mt-1">{campaignDate ? formatDateBR(campaignDate) : "A definir"}</p>
                </div>
              </div>
            </div>

            {/* Resumo principal (invited) */}
            {isInvitedInfluencer && (
              <div className="glass-card p-4 border border-primary/15">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>

                  <div className="min-w-0 w-full">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Resumo do que será pedido</p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="text-[10px] px-2 py-1 rounded-full border border-border/50 bg-card/60 text-muted-foreground">
                        Posts: <b className="text-foreground">{typeof invitedSummary.posts === "number" ? invitedSummary.posts : "—"}</b>
                      </span>

                      <span className="text-[10px] px-2 py-1 rounded-full border border-border/50 bg-card/60 text-muted-foreground">
                        Formato: <b className="text-foreground">{invitedSummary.format || "—"}</b>
                      </span>

                      <span className="text-[10px] px-2 py-1 rounded-full border border-border/50 bg-card/60 text-muted-foreground inline-flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Creators:{" "}
                        <b className="text-foreground">{typeof invitedSummary.creatorsNeeded === "number" ? invitedSummary.creatorsNeeded : "—"}</b>
                      </span>
                    </div>

                    {invitedSummary.segments.length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Segmentos: <span className="text-foreground/90 font-medium">{invitedSummary.segments.join(", ")}</span>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground mt-3">
                      Após confirmar, você verá legenda, hashtags, menções, briefing completo e arquivos.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!!briefPublic && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold text-foreground text-sm">Descrição</h4>
                </div>
                <div className="glass-card p-4">
                  <p className="text-sm text-foreground/75 leading-relaxed whitespace-pre-line">{briefPublic}</p>
                </div>
              </div>
            )}

            {/* Contractor vê completo (invited não vê o sensível aqui) */}
            {!isInvitedInfluencer && (
              <>
                {!!briefPrivate && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-accent" />
                      <h4 className="font-semibold text-foreground text-sm">Briefing completo</h4>
                    </div>
                    <div className="glass-card p-4 border border-accent/15">
                      <p className="text-sm text-foreground/75 leading-relaxed whitespace-pre-line">{briefPrivate}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-primary" />
                    <h4 className="font-semibold text-foreground text-sm">Requisitos e entregas</h4>
                  </div>

                  {requirements ? (
                    <div className="glass-card p-4">
                      <div className="text-xs text-muted-foreground">Tudo que foi definido na criação da campanha.</div>
                      <div className="mt-3 space-y-3">
                        {Object.entries(requirements).map(([k, v]) => (
                          <div key={k} className="rounded-xl border border-border/50 bg-card/60 p-3">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{humanizeKey(k)}</div>
                            <div className="mt-1 text-sm text-foreground/80 leading-relaxed">{renderValue(v)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="glass-card p-4">
                      <p className="text-sm text-muted-foreground">Nenhum requisito definido.</p>
                    </div>
                  )}
                </div>

                <div className="glass-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">Informações</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-border/50 bg-card/60 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</div>
                      <div className="mt-1 text-sm text-foreground/80">{statusLabel(status)}</div>
                    </div>

                    <div className="rounded-xl border border-border/50 bg-card/60 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">ID</div>
                      <div className="mt-1 text-xs text-foreground/70 truncate" title={(campaign as any)?.id}>
                        {(campaign as any)?.id || "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </MobileLayout>
  );
};

export default CampaignView;