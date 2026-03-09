import { useState, useEffect, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import {
  MapPin,
  Calendar,
  Loader2,
  CheckCircle2,
  Paperclip,
  Sparkles,
  ClipboardCheck,
  ShieldCheck,
  BadgeCheck,
  Info,
  TicketPercent,
  Wallet,
  X,
  Link as LinkIcon,
  FileText,
  CheckSquare,
  Square,
  Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { PublicCampaignFeed } from "@/types/database";
import CampaignFilesTab from "@/components/campaign/CampaignFilesTab";
import PublicProfile from "@/pages/profile/PublicProfile";
import { toast } from "sonner";
import type { CampaignFileKind } from "@/services/campaignFiles";

type TabKey = "details" | "files";
type ParticipantStatus = "invited" | "confirmed" | "delivered" | "approved";

type PublicProfileLite = {
  id: string;
  name?: string | null;
  instagram?: string | null;
  avatar_url?: string | null;
};

type DeliverablesRow = {
  creator_id: string;
  status?: "draft" | "submitted" | "approved" | "changes_requested";
  checklist?: Record<string, any> | null;
  links?: any;
  notes?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  updated_at?: string | null;
};

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

const formatMoneyBRL = (v?: number | null) => {
  const n = typeof v === "number" ? v : v ? Number(v) : null;
  if (n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
  if (s === "closed_manual") return "Encerrada";
  if (s === "closed_expired") return "Vencida";
  if (s === "completed") return "Concluída";
  if (s === "deleted") return "Excluída";
  if (s === "draft") return "Rascunho";
  if (s === "pending_payment") return "Pagamento pendente";
  return s;
};

const translateCampaignType = (type?: string | null) => {
  const raw = String(type || "").trim().toLowerCase();

  if (raw === "music") return "Música";
  if (raw === "event") return "Evento";
  if (raw === "product") return "Produto/Serviço";

  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "Campanha";
};

const getInitials = (name?: string | null) => {
  const n = (name || "").trim();
  if (!n) return "•";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0].slice(0, 1);
  const last = parts[parts.length - 1].slice(0, 1);
  return `${first}${last}`.toUpperCase();
};

const CHECKLIST_LABELS: Record<string, string> = {
  posts_done: "Realizei os posts combinados",
  format_done: "Entreguei no formato combinado",
  mentions_done: "Fiz as menções solicitadas",
  hashtags_done: "Usei as hashtags solicitadas",
  caption_done: "Usei a legenda solicitada",
  collab_done: "Publicação em collab realizada",
  proof_files: "Anexei prints/arquivos de comprovação",
  proof_links: "Adicionei link(s) da(s) publicação(ões)",
};

const isValidKind = (k?: string | null): k is CampaignFileKind => k === "assets" || k === "deliverables";

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

const IconActionButton = (props: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: ReactNode;
  tone?: "default" | "primary" | "accent";
  showDot?: boolean;
}) => {
  const tone = props.tone ?? "default";

  const toneClass =
    tone === "primary"
      ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
      : tone === "accent"
        ? "border-accent/30 bg-accent/10 text-accent hover:bg-accent/15"
        : "border-border/50 bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card/80";

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      aria-label={props.title}
      className={`relative w-10 h-10 rounded-2xl border transition flex items-center justify-center ${toneClass} disabled:opacity-60`}
    >
      {props.showDot && !props.disabled && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent border border-background shadow" />
      )}
      {props.children}
    </button>
  );
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

  const [creatorProfiles, setCreatorProfiles] = useState<Record<string, PublicProfileLite>>({});
  const [participants, setParticipants] = useState<Array<{ influencer_id: string; status: ParticipantStatus | null }>>([]);

  const [deliverablesMap, setDeliverablesMap] = useState<Record<string, DeliverablesRow>>({});
  const [approvingCreatorId, setApprovingCreatorId] = useState<string | null>(null);

  const [deliverableModalOpen, setDeliverableModalOpen] = useState(false);
  const [deliverableModalCreatorId, setDeliverableModalCreatorId] = useState<string | null>(null);
  const [deliverableModalLoading, setDeliverableModalLoading] = useState(false);
  const [deliverableModalRow, setDeliverableModalRow] = useState<DeliverablesRow | null>(null);

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalCreatorId, setProfileModalCreatorId] = useState<string | null>(null);

  const isContractor = userRole === "contractor";
  const isInfluencer = userRole === "influencer";

  const urlKind = (() => {
    const sp = new URLSearchParams(location.search);
    const k = sp.get("kind");
    return isValidKind(k) ? (k as CampaignFileKind) : undefined;
  })();

  const urlCreator = (() => {
    const sp = new URLSearchParams(location.search);
    const c = (sp.get("creator") || "").trim();
    return c ? c : undefined;
  })();

  const setTabWithUrl = useCallback(
    (next: TabKey, opts?: { kind?: CampaignFileKind; creator?: string; clearFilters?: boolean }) => {
      setTab(next);

      const sp = new URLSearchParams(location.search);
      sp.set("tab", next);

      const clear = !!opts?.clearFilters;

      if (next !== "files" || clear) {
        sp.delete("kind");
        sp.delete("creator");
      } else {
        if (opts?.kind) sp.set("kind", opts.kind);
        else sp.delete("kind");

        if (opts?.creator) sp.set("creator", opts.creator);
        else sp.delete("creator");
      }

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
  }, [location.search, tab]);

  useEffect(() => {
    const modalOpen = deliverableModalOpen || profileModalOpen;
    if (!modalOpen) return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyTouchAction = document.body.style.touchAction;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.touchAction = previousBodyTouchAction;
    };
  }, [deliverableModalOpen, profileModalOpen]);

  const openCreatorProfileModal = (creatorId: string) => {
    setProfileModalCreatorId(creatorId);
    setProfileModalOpen(true);
  };

  const closeCreatorProfileModal = () => {
    setProfileModalOpen(false);
    setProfileModalCreatorId(null);
  };

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
  }, [authReady, userRole, id, user, isContractor]);

  useEffect(() => {
    const run = async () => {
      if (!isContractor || !id || !user || !campaign) return;

      const req = (((campaign as any)?.requirements as CampaignRequirements | null) ?? null);
      const selectedIds: string[] = Array.isArray(req?.internal?.selected_creator_ids)
        ? req.internal!.selected_creator_ids.filter((x: any) => typeof x === "string" && x.trim().length > 0)
        : [];

      const { data: partData, error: partErr } = await supabase
        .from("campaign_participants")
        .select("influencer_id,status")
        .eq("campaign_id", id);

      if (partErr) console.error("FETCH_PARTICIPANTS_ERROR", partErr);

      const pRows = (partData || []).map((r: any) => ({
        influencer_id: String(r.influencer_id),
        status: (r.status as ParticipantStatus) || null,
      }));
      setParticipants(pRows);

      const ids = Array.from(new Set([...selectedIds, ...pRows.map((p) => p.influencer_id)]));

      if (ids.length > 0) {
        const { data: profData, error: profErr } = await supabase
          .from("public_profiles")
          .select("id,name,instagram,avatar_url")
          .in("id", ids);

        if (profErr) console.error("FETCH_PUBLIC_PROFILES_ERROR", profErr);

        const map: Record<string, PublicProfileLite> = {};
        for (const row of (profData || []) as any[]) map[String(row.id)] = row;
        setCreatorProfiles(map);
      } else {
        setCreatorProfiles({});
      }

      try {
        const { data: deliv, error: delivErr } = await supabase
          .from("campaign_creator_deliverables")
          .select("creator_id,status,updated_at,submitted_at,approved_at")
          .eq("campaign_id", id);

        if (delivErr) {
          console.error("FETCH_DELIVERABLES_MIN_ERROR", delivErr);
          setDeliverablesMap({});
        } else {
          const dmap: Record<string, DeliverablesRow> = {};
          for (const r of (deliv || []) as any[]) dmap[String(r.creator_id)] = r as DeliverablesRow;
          setDeliverablesMap(dmap);
        }
      } catch {
        setDeliverablesMap({});
      }
    };

    run();
  }, [isContractor, id, user, campaign]);

  const openDeliverablesModal = async (creatorId: string) => {
    if (!id) return;

    setDeliverableModalOpen(true);
    setDeliverableModalCreatorId(creatorId);
    setDeliverableModalLoading(true);
    setDeliverableModalRow(null);

    try {
      const { data, error } = await supabase
        .from("campaign_creator_deliverables")
        .select("creator_id,checklist,links,notes,submitted_at,updated_at")
        .eq("campaign_id", id)
        .eq("creator_id", creatorId)
        .maybeSingle();

      if (error) {
        console.error("FETCH_DELIVERABLES_DETAIL_ERROR", error);
        toast.error("Não foi possível carregar as entregas.");
        setDeliverableModalRow(null);
        return;
      }

      if (!data) {
        toast.message("Este creator ainda não enviou entregas.");
        setDeliverableModalRow(null);
        return;
      }

      setDeliverableModalRow(data as any);
    } finally {
      setDeliverableModalLoading(false);
    }
  };

  const closeDeliverablesModal = () => {
    setDeliverableModalOpen(false);
    setDeliverableModalCreatorId(null);
    setDeliverableModalRow(null);
    setDeliverableModalLoading(false);
  };

  const approveCreator = async (creatorId: string) => {
    if (!id) return;

    if (!window.confirm("Confirmar entregas deste creator?\n\nUse apenas quando estiver tudo correto.")) return;

    setApprovingCreatorId(creatorId);
    try {
      const approvedAt = new Date().toISOString();

      const { data: updatedRows, error: updateErr } = await supabase
        .from("campaign_creator_deliverables")
        .update({
          status: "approved",
          approved_at: approvedAt,
          updated_at: approvedAt,
        })
        .eq("campaign_id", id)
        .eq("creator_id", creatorId)
        .select("campaign_id, creator_id");

      if (updateErr) throw updateErr;

      if (!updatedRows || updatedRows.length === 0) {
        const { error: insertErr } = await supabase
          .from("campaign_creator_deliverables")
          .insert({
            campaign_id: id,
            creator_id: creatorId,
            status: "approved",
            approved_at: approvedAt,
            updated_at: approvedAt,
            checklist: {},
            links: [],
            notes: null,
            submitted_at: null,
          });

        if (insertErr) throw insertErr;
      }

      const { error: pErr } = await supabase
        .from("campaign_participants")
        .update({
          status: "approved",
          approved_at: approvedAt,
        })
        .eq("campaign_id", id)
        .eq("influencer_id", creatorId);

      if (pErr) throw pErr;

      toast.success("Entregas confirmadas.");

      setParticipants((prev) => prev.map((p) => (p.influencer_id === creatorId ? { ...p, status: "approved" } : p)));
      setDeliverablesMap((prev) => ({
        ...prev,
        [creatorId]: {
          ...(prev[creatorId] || ({} as any)),
          creator_id: creatorId,
          status: "approved",
          approved_at: approvedAt,
          updated_at: approvedAt,
        },
      }));
    } catch (e: any) {
      console.error("APPROVE_CREATOR_ERROR", e);
      toast.error(e?.message || "Erro ao confirmar entregas.");
    } finally {
      setApprovingCreatorId(null);
    }
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

  const isInvitedInfluencer = isInfluencer && myParticipationStatus === "invited";
  const shouldShowInfluencerConfirmCta = isInvitedInfluencer;
  const shouldShowRequirementsToInfluencer = isInfluencer;
  const shouldShowCompensationToInfluencer = isInfluencer;

  const status = (campaign as any)?.status as string | null;
  const req = (((campaign as any)?.requirements as CampaignRequirements | null) ?? null);

  const city = ((campaign as any)?.city as string | null) ?? null;
  const state = ((campaign as any)?.state as string | null) ?? null;
  const region = ((campaign as any)?.region as string | null) ?? null;
  const locationLabel = [city, state].filter(Boolean).join(", ") || "—";

  const campaignDate = ((campaign as any)?.campaign_date as string | null) ?? null;

  const briefPublic = ((campaign as any)?.brief_public as string | null) ?? null;
  const briefPrivate = ((campaign as any)?.brief_private as string | null) ?? null;

  const contentSegments = req?.content_segments ?? [];
  const creatorsCount =
    typeof req?.creators_needed === "number" ? req.creators_needed : req?.creators_needed ? Number(req.creators_needed) : null;

  const deliverables = req?.deliverables ?? null;
  const pricing = req?.pricing ?? null;
  const internal = req?.internal ?? null;

  const quoteTotal =
    typeof internal?.quote_total === "number" ? internal.quote_total : internal?.quote_total ? Number(internal.quote_total) : null;

  const quoteSubtotal =
    typeof internal?.quote_subtotal === "number" ? internal.quote_subtotal : internal?.quote_subtotal ? Number(internal.quote_subtotal) : null;

  const quoteDiscount =
    typeof internal?.quote_discount === "number" ? internal.quote_discount : internal?.quote_discount ? Number(internal.quote_discount) : null;

  const couponCode = typeof internal?.coupon_code === "string" ? internal.coupon_code.trim() : null;

  const selectedCreatorIds: string[] = Array.isArray(internal?.selected_creator_ids)
    ? internal.selected_creator_ids.filter((x: any) => typeof x === "string" && x.trim().length > 0)
    : [];

  const creatorsToRender = Array.from(new Set([...(selectedCreatorIds || []), ...(participants.map((p) => p.influencer_id) || [])]));

  const modalCreatorProfile = deliverableModalCreatorId ? creatorProfiles[deliverableModalCreatorId] : null;
  const modalCreatorName = (modalCreatorProfile?.name || "Creator").trim();
  const modalCreatorIg = normalizeAt(modalCreatorProfile?.instagram) || null;

  const normalizedLinks: string[] = (() => {
    const raw = deliverableModalRow?.links;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map((x) => String(x ?? "")).map((s) => s.trim()).filter(Boolean);
    if (typeof raw === "string") return [raw.trim()].filter(Boolean);
    if (raw && typeof raw === "object") return Object.values(raw).map((x) => String(x ?? "")).map((s) => s.trim()).filter(Boolean);
    return [];
  })();

  const checklistEntries = (() => {
    const ck = deliverableModalRow?.checklist;
    if (!ck || typeof ck !== "object") return [];
    return Object.entries(ck).map(([k, v]) => ({
      key: k,
      label: CHECKLIST_LABELS[k] || k,
      value: !!v,
    }));
  })();

  const confirmedCreatorIds = creatorsToRender.filter((cid) => {
    const p = participants.find((x) => x.influencer_id === cid);
    if (!p) return true;

    return (
      p.status === "confirmed" ||
      p.status === "delivered" ||
      p.status === "approved"
    );
  });

  return (
    <MobileLayout title={campaign.title} showBack backTo={backTo} navType={navType} showNav={false} showHome homeRoute={backTo}>
      <div className="px-6 py-6 space-y-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
              {translateCampaignType((campaign as any)?.type)}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-card/60 text-muted-foreground font-medium">
              {statusLabel(status)}
            </span>

            {isInvitedInfluencer && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-warning/40 bg-warning/10 text-warning font-medium">
                Convite pendente
              </span>
            )}
          </div>

          <h2 className="font-display text-2xl font-bold text-foreground">{campaign.title}</h2>

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
            </div>
          )}
        </motion.div>

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
              onClick={() => setTabWithUrl("files", { kind: "deliverables", clearFilters: false })}
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
          <CampaignFilesTab
            campaignId={String(id)}
            role="contractor"
            influencerAccepted={false}
            readOnly
            kindFilter="deliverables"
            ownerIdFilter={urlCreator}
          />
        )}

        {tab === "details" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card p-4 col-span-2">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Local</p>
                    <p className="text-sm font-semibold text-foreground mt-1">{locationLabel}</p>
                    {!!region && <p className="text-xs text-muted-foreground mt-1">Região: {region}</p>}
                  </div>
                </div>
              </div>

              <div className="glass-card p-4 col-span-2 border border-accent/15">
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
            </div>

            {!!briefPublic && (
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-accent" />
                  <h4 className="font-semibold text-foreground text-sm">Objetivos</h4>
                </div>
                <p className="text-sm text-foreground/75 leading-relaxed whitespace-pre-line">{briefPublic}</p>
              </div>
            )}

            {isContractor && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold text-foreground text-sm">Creators da campanha</h4>
                </div>

                <div className="glass-card p-4">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap overflow-hidden text-ellipsis">Valide entregas por creator.</span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {confirmedCreatorIds.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Nenhum creator confirmado ainda.</div>
                    ) : (
                      confirmedCreatorIds.map((creatorId) => {
                        const prof = creatorProfiles[creatorId] || null;
                        const name = (prof?.name || "—").trim();
                        const ig = normalizeAt(prof?.instagram) || null;

                        const p = participants.find((x) => x.influencer_id === creatorId);
                        const isApproved = p?.status === "approved";
                        const isDelivered = p?.status === "delivered";

                        const hasDeliverables = !!deliverablesMap[creatorId];
                        const isBusy = approvingCreatorId === creatorId;

                        const showDeliverablesDot = hasDeliverables && (isDelivered || !isApproved);

                        return (
                          <div key={creatorId} className="rounded-2xl border border-border/50 bg-white/5 px-3 py-2.5">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => openCreatorProfileModal(creatorId)}
                                  className="w-10 h-10 rounded-2xl border border-border/50 bg-card/60 overflow-hidden flex items-center justify-center shrink-0 hover:opacity-90 transition"
                                  title="Ver perfil público"
                                >
                                  {prof?.avatar_url ? (
                                    <img src={prof.avatar_url} alt={name} className="w-full h-full object-cover" loading="lazy" />
                                  ) : (
                                    <span className="text-[11px] font-bold text-primary">{getInitials(name)}</span>
                                  )}
                                </button>

                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-foreground truncate">{name}</div>
                                  <div className="text-xs text-muted-foreground truncate">{ig || "—"}</div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <IconActionButton
                                  onClick={() => {
                                    if (!hasDeliverables) {
                                      toast.message("Este creator ainda não enviou entregas.");
                                      return;
                                    }
                                    openDeliverablesModal(creatorId);
                                  }}
                                  disabled={!hasDeliverables}
                                  title={hasDeliverables ? "Ver entregas" : "Ainda sem entregas"}
                                  tone="default"
                                  showDot={showDeliverablesDot}
                                >
                                  <ClipboardCheck className="w-4 h-4" />
                                </IconActionButton>

                                <IconActionButton
                                  onClick={() => approveCreator(creatorId)}
                                  disabled={isApproved || isBusy}
                                  title={isApproved ? "Confirmado" : "Confirmar entregas"}
                                  tone={isApproved ? "accent" : "primary"}
                                >
                                  {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
                                </IconActionButton>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            <>
              {isContractor && !!briefPrivate && (
                <div className="glass-card p-4 border border-accent/15">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-accent" />
                    <h4 className="font-semibold text-foreground text-sm">Briefing completo</h4>
                  </div>
                  <p className="text-sm text-foreground/75 leading-relaxed whitespace-pre-line">{briefPrivate}</p>
                </div>
              )}

              {(isContractor || shouldShowRequirementsToInfluencer) && (
                <div className="glass-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-primary" />
                    <h4 className="font-semibold text-foreground text-sm">
                      {isContractor ? "Detalhes definidos na criação" : "Requisitos da campanha"}
                    </h4>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <DetailRow label="Segmentos de conteúdo" value={renderSimpleValue(contentSegments)} />
                    <DetailRow label="Creators necessários" value={renderSimpleValue(creatorsCount)} />
                    <DetailRow label="Quantidade de posts" value={renderSimpleValue(deliverables?.posts)} />
                    <DetailRow label="Formato do conteúdo" value={renderSimpleValue(deliverables?.format)} />
                    <DetailRow label="Legenda" value={renderSimpleValue(deliverables?.caption)} />
                    <DetailRow label="Hashtags" value={renderSimpleValue(deliverables?.hashtags)} />
                    <DetailRow label="Menções" value={renderSimpleValue(deliverables?.mentions)} />
                    <DetailRow label="Post em collab" value={renderSimpleValue(deliverables?.collab)} />
                    <DetailRow label="Menções da collab" value={renderSimpleValue(deliverables?.collab_mentions)} />
                  </div>
                </div>
              )}
            </>

            {isContractor && (
              <div className="glass-card p-4 border border-primary/15">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-primary" />
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Valores</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Resumo financeiro da campanha</p>
                  </div>

                  <span className="text-[10px] px-2 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary font-medium whitespace-nowrap">
                    {formatMoneyBRL(quoteTotal)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/50 bg-card/60 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Subtotal</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{formatMoneyBRL(quoteSubtotal)}</div>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-card/60 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Desconto</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{formatMoneyBRL(quoteDiscount)}</div>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-card/60 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Creators</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{renderSimpleValue(creatorsCount)}</div>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-card/60 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor por creator</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{formatMoneyBRL(pricing?.creator_fee ?? null)}</div>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-card/60 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Posts por creator</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{renderSimpleValue(pricing?.posts_count)}</div>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-card/60 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor por post</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{formatMoneyBRL(pricing?.price_per_post ?? null)}</div>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-border/50 bg-card/60 p-3 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <TicketPercent className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cupom utilizado</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{couponCode || "—"}</div>
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-muted-foreground flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 mt-0.5" />
                  <span>Valores e aprovações devem ser feitos com cuidado para evitar conflitos futuros com entregas e pagamentos.</span>
                </div>
              </div>
            )}

            {shouldShowCompensationToInfluencer && (
              <div className="glass-card p-4 border border-primary/15">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold text-foreground text-sm">Sua remuneração nesta campanha</h4>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/50 bg-card/60 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor por creator</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{formatMoneyBRL(pricing?.creator_fee ?? null)}</div>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-card/60 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Posts por creator</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{renderSimpleValue(pricing?.posts_count)}</div>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-card/60 p-3 col-span-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor por post</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{formatMoneyBRL(pricing?.price_per_post ?? null)}</div>
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-muted-foreground flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Ao confirmar participação, você libera o restante do fluxo da campanha e pode seguir para entregas normalmente.
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {deliverableModalOpen && isContractor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeDeliverablesModal();
            }}
          >
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="w-full max-w-[560px] h-[85vh] rounded-3xl border border-border/50 bg-background/95 shadow-2xl overflow-hidden flex flex-col"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground uppercase tracking-widest">Entregas</div>
                      <div className="mt-1 text-lg font-bold text-foreground truncate">{modalCreatorName}</div>
                      {modalCreatorIg && <div className="text-xs text-muted-foreground mt-0.5">{modalCreatorIg}</div>}
                    </div>

                    <button
                      onClick={closeDeliverablesModal}
                      className="w-10 h-10 rounded-2xl border border-border/50 bg-card/60 hover:bg-card/80 transition flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
                      title="Fechar"
                      type="button"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-5 touch-pan-y">
                  {deliverableModalLoading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    </div>
                  ) : !deliverableModalRow ? (
                    <div className="text-center py-10">
                      <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <div className="text-sm text-muted-foreground">Nenhuma entrega encontrada para este creator.</div>
                    </div>
                  ) : (
                    <div className="space-y-4 pb-6">
                      <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <ClipboardCheck className="w-4 h-4 text-primary" />
                          <div className="text-sm font-semibold text-foreground">Confirmações</div>
                        </div>

                        {checklistEntries.length === 0 ? (
                          <div className="text-sm text-muted-foreground">Nenhuma confirmação marcada.</div>
                        ) : (
                          <div className="space-y-2">
                            {checklistEntries.map((it) => (
                              <div key={it.key} className="flex items-center gap-2 rounded-xl border border-border/40 bg-white/5 px-3 py-2">
                                {it.value ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                                <div className={`text-sm ${it.value ? "text-foreground/85" : "text-muted-foreground"}`}>{it.label}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <LinkIcon className="w-4 h-4 text-accent" />
                          <div className="text-sm font-semibold text-foreground">Links de comprovação</div>
                        </div>

                        {normalizedLinks.length === 0 ? (
                          <div className="text-sm text-muted-foreground">Nenhum link enviado.</div>
                        ) : (
                          <div className="space-y-2">
                            {normalizedLinks.map((url, idx) => (
                              <button
                                key={`${url}-${idx}`}
                                onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                                className="w-full text-left rounded-xl border border-border/40 bg-white/5 px-3 py-2 hover:bg-white/10 transition"
                                title="Abrir link"
                                type="button"
                              >
                                <div className="text-sm text-foreground truncate">{url}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Paperclip className="w-4 h-4 text-primary" />
                          <div className="text-sm font-semibold text-foreground">Arquivos recebidos</div>
                        </div>

                        <CampaignFilesTab
                          campaignId={String(id)}
                          role="contractor"
                          influencerAccepted={false}
                          readOnly
                          kindFilter="deliverables"
                          ownerIdFilter={deliverableModalCreatorId || undefined}
                        />
                      </div>

                      <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="w-4 h-4 text-primary" />
                          <div className="text-sm font-semibold text-foreground">Notas</div>
                        </div>

                        {deliverableModalRow.notes ? (
                          <div className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">{deliverableModalRow.notes}</div>
                        ) : (
                          <div className="text-sm text-muted-foreground">Sem notas.</div>
                        )}
                      </div>

                      <div className="text-[11px] text-muted-foreground flex items-start gap-2">
                        <Info className="w-4 h-4 mt-0.5 shrink-0" />
                        <div>
                          <div>
                            Enviado: <span className="text-foreground/80">{formatDateTimeBR(deliverableModalRow.submitted_at)}</span>
                          </div>
                          <div>
                            Atualizado: <span className="text-foreground/80">{formatDateTimeBR(deliverableModalRow.updated_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {profileModalOpen && profileModalCreatorId && isContractor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeCreatorProfileModal();
            }}
          >
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="w-full max-w-[720px] h-[88vh] rounded-3xl border border-border/50 bg-background/95 shadow-2xl overflow-hidden flex flex-col"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="px-5 pt-5 pb-4 border-b border-border/40 shrink-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mt-1 text-lg font-bold text-foreground truncate">
                        {creatorProfiles[profileModalCreatorId]?.name || "Creator"}
                      </div>
                    </div>

                    <button
                      onClick={closeCreatorProfileModal}
                      className="w-10 h-10 rounded-2xl border border-border/50 bg-card/60 hover:bg-card/80 transition flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
                      title="Fechar"
                      type="button"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y">
                  <PublicProfile key={profileModalCreatorId} idOverride={profileModalCreatorId} />
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MobileLayout>
  );
};

export default CampaignView;