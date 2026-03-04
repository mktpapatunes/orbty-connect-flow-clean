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
  Sparkles,
  Users,
  ClipboardCheck,
  ShieldCheck,
  BadgeCheck,
  XCircle,
  Info,
  CheckSquare,
  Square,
  Link as LinkIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { PublicCampaignFeed } from "@/types/database";
import CampaignFilesTab from "@/components/campaign/CampaignFilesTab";
import { toast } from "sonner";

type TabKey = "details" | "files";
type ParticipantStatus = "invited" | "confirmed" | "delivered" | "approved";

type PublicProfileLite = {
  id: string;
  display_name?: string | null;
  name?: string | null;
  instagram?: string | null;
};

type DeliverablesRowLite = {
  creator_id: string;
  campaign_id?: string;
  status?: "draft" | "submitted" | "approved" | "changes_requested";
  updated_at?: string;
  submitted_at?: string | null;

  // pode existir na sua tabela (ou não)
  confirmations?: Record<string, any> | null;
  checks?: Record<string, any> | null;
  checklist?: Record<string, any> | null;
  steps?: Record<string, any> | null;

  // pode existir
  links?: any;
  note?: any;

  // fallback: qualquer coisa
  [k: string]: any;
};

const formatDateBR = (value?: string | null) => {
  if (!value) return "-";
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = isDateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return isDateOnly ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : d.toLocaleDateString("pt-BR");
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

const formatLabel = (format?: string | null) => {
  const f = (format || "").toLowerCase().trim();
  if (!f) return "—";
  if (f === "stories") return "Stories";
  if (f === "reels") return "Reels";
  if (f === "feed") return "Feed";
  if (f === "misto") return "Misto";
  return format || "—";
};

const statusLabel = (s?: string | null) => {
  if (!s) return "—";
  if (s === "active") return "Ativa";
  if (s === "closed_manual") return "Encerrada";
  if (s === "closed_expired") return "Vencida";
  if (s === "completed") return "Concluída";
  if (s === "deleted") return "Excluída";
  if (s === "draft") return "Rascunho";
  return s;
};

const REQUIREMENTS_LABELS: Record<string, string> = {
  posts: "Quantidade de posts",
  format: "Formato",
  caption: "Legenda",
  hashtags: "Hashtags",
  mentions: "Menções",
  collab: "Post em collab",
  collab_mentions: "Menções (collab)",
  coupon_code: "Cupom",
  quote_total: "Valor total",
  quote_subtotal: "Subtotal",
  quote_discount: "Desconto",
  creators_needed: "Creators necessários",
  content_segments: "Segmentos",
  selected_creator_ids: "Creators selecionados",
};

const VALUE_KEYS = new Set(["quote_total", "quote_subtotal", "quote_discount"]);

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

const deliverableStatusLabel = (s?: string | null) => {
  if (s === "draft") return { text: "Rascunho", cls: "border-border/50 bg-card/60 text-muted-foreground" };
  if (s === "submitted") return { text: "Em revisão", cls: "border-primary/30 bg-primary/10 text-primary" };
  if (s === "approved") return { text: "Aprovado", cls: "border-accent/30 bg-accent/10 text-accent" };
  if (s === "changes_requested") return { text: "Ajustes", cls: "border-warning/30 bg-warning/10 text-warning" };
  return { text: "—", cls: "border-border/50 bg-card/60 text-muted-foreground" };
};

const humanizeKey = (key: string) => {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

function renderAny(v: any) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;

  if (Array.isArray(v)) {
    if (v.length === 0) return "—";
    return (
      <ul className="mt-1 space-y-1">
        {v.map((item: any, idx: number) => (
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
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
            <div className="mt-1 text-sm text-foreground/80 leading-relaxed">{renderAny(val)}</div>
          </div>
        ))}
      </div>
    );
  }

  return String(v);
}

function extractConfirmations(row?: DeliverablesRowLite | null): Array<{ key: string; label: string; done: boolean }> {
  if (!row) return [];

  const obj =
    (row.confirmations && typeof row.confirmations === "object" ? row.confirmations : null) ||
    (row.checks && typeof row.checks === "object" ? row.checks : null) ||
    (row.checklist && typeof row.checklist === "object" ? row.checklist : null) ||
    (row.steps && typeof row.steps === "object" ? row.steps : null) ||
    null;

  const pairs: Array<[string, any]> = obj ? Object.entries(obj) : [];

  // fallback: varre booleans no row
  if (!pairs.length) {
    const maybe = Object.entries(row).filter(([k, v]) => {
      if (typeof v !== "boolean") return false;
      const kk = k.toLowerCase();
      return (
        kk.startsWith("confirm_") ||
        kk.startsWith("confirmed_") ||
        kk.startsWith("done_") ||
        kk.endsWith("_done") ||
        kk.endsWith("_ok") ||
        kk.startsWith("is_")
      );
    });
    pairs.push(...maybe);
  }

  const labelMap: Record<string, string> = {
    posts: "Realizou os posts combinados",
    mentions: "Fez as marcações (menções)",
    hashtags: "Usou as hashtags",
    caption: "Usou a legenda solicitada",
    collab: "Publicou em collab",
    print: "Anexou print de comprovação",
    link: "Adicionou link da publicação",
  };

  return pairs
    .filter(([_, v]) => typeof v === "boolean")
    .map(([k, v]) => {
      const clean = k.replace(/^confirm(ed)?_/, "").replace(/^done_/, "").replace(/_done$/, "").replace(/_ok$/, "");
      return {
        key: k,
        label: labelMap[clean] || humanizeKey(clean),
        done: !!v,
      };
    });
}

function extractLinks(row?: DeliverablesRowLite | null): string[] {
  if (!row) return [];
  const raw = row.links;

  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  if (Array.isArray(raw)) return raw.map((x) => String(x || "").trim()).filter(Boolean);
  if (raw && typeof raw === "object") {
    // ex.: { post: "url", stories: "url" }
    return Object.values(raw)
      .map((x) => String(x || "").trim())
      .filter(Boolean);
  }

  // fallback: campos comuns
  const candidates = ["post_link", "publication_link", "link", "url", "reel_link", "story_link"];
  const out: string[] = [];
  for (const c of candidates) {
    const v = row[c];
    if (typeof v === "string" && v.trim()) out.push(v.trim());
  }
  return Array.from(new Set(out));
}

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
  const [deliverablesMap, setDeliverablesMap] = useState<Record<string, DeliverablesRowLite>>({});
  const [approvingCreatorId, setApprovingCreatorId] = useState<string | null>(null);

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

  // Contractor: puxar creators + deliverables (inclui confirmações)
  useEffect(() => {
    const run = async () => {
      if (!isContractor || !id || !user || !campaign) return;

      const req = ((campaign as any)?.requirements as Record<string, any> | null) ?? null;
      const selectedIds: string[] = Array.isArray(req?.selected_creator_ids)
        ? req!.selected_creator_ids.filter((x: any) => typeof x === "string" && x.trim().length > 0)
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
          .select("id,display_name,name,instagram")
          .in("id", ids);

        if (profErr) console.error("FETCH_PUBLIC_PROFILES_ERROR", profErr);

        const map: Record<string, PublicProfileLite> = {};
        for (const row of (profData || []) as any[]) map[String(row.id)] = row;
        setCreatorProfiles(map);
      } else {
        setCreatorProfiles({});
      }

      // ✅ Agora buscamos tudo (*) para resgatar confirmações que você já criou
      try {
        const { data: deliv, error: delivErr } = await supabase
          .from("campaign_creator_deliverables")
          .select("*")
          .eq("campaign_id", id);

        if (delivErr) {
          const msg = (delivErr.message || "").toLowerCase();
          const looksMissing =
            msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("permission denied");
          if (!looksMissing) console.error("FETCH_DELIVERABLES_ERROR", delivErr);
          setDeliverablesMap({});
        } else {
          const dmap: Record<string, DeliverablesRowLite> = {};
          for (const r of (deliv || []) as any[]) dmap[String(r.creator_id)] = r as DeliverablesRowLite;
          setDeliverablesMap(dmap);
        }
      } catch (e) {
        setDeliverablesMap({});
      }
    };

    run();
  }, [isContractor, id, user, campaign]);

  const approveCreator = async (creatorId: string) => {
    if (!id) return;

    const dRow = deliverablesMap[creatorId];
    const confirmations = extractConfirmations(dRow);
    const hasAllChecks = confirmations.length > 0 ? confirmations.every((x) => x.done) : true; // se não existir checklist, não bloqueia
    const links = extractLinks(dRow);

    const warning =
      confirmations.length > 0 && !hasAllChecks
        ? "\n\n⚠️ Atenção: o creator ainda não marcou todas as confirmações."
        : "";

    if (
      !window.confirm(
        `Aprovar este creator?\nUse apenas quando as entregas foram conferidas (arquivos e links) e estiver tudo correto.${warning}`
      )
    )
      return;

    setApprovingCreatorId(creatorId);
    try {
      const { error: dErr } = await supabase
        .from("campaign_creator_deliverables")
        .upsert(
          {
            campaign_id: id,
            creator_id: creatorId,
            status: "approved",
            approved_at: new Date().toISOString(),
          } as any,
          { onConflict: "campaign_id,creator_id" }
        );

      if (dErr) {
        const msg = (dErr.message || "").toLowerCase();
        const looksMissing = msg.includes("does not exist") || msg.includes("schema cache");
        if (!looksMissing) throw dErr;
      }

      const { error: pErr } = await supabase
        .from("campaign_participants")
        .update({ status: "approved" })
        .eq("campaign_id", id)
        .eq("influencer_id", creatorId);

      if (pErr) throw pErr;

      toast.success("Creator aprovado com sucesso.");

      setParticipants((prev) => prev.map((p) => (p.influencer_id === creatorId ? { ...p, status: "approved" } : p)));
      setDeliverablesMap((prev) => ({
        ...prev,
        [creatorId]: {
          ...(prev[creatorId] || {}),
          creator_id: creatorId,
          status: "approved",
          updated_at: new Date().toISOString(),
        },
      }));

      // opcional: se já tem links, dá um feedback
      if (links.length) toast.message("Links registrados nas entregas.", { description: links[0] });
    } catch (e: any) {
      console.error("APPROVE_CREATOR_ERROR", e);
      toast.error(e?.message || "Erro ao aprovar creator.");
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

  const status = (campaign as any)?.status as string | null;
  const req = ((campaign as any)?.requirements as Record<string, any> | null) ?? null;

  const city = ((campaign as any)?.city as string | null) ?? null;
  const state = ((campaign as any)?.state as string | null) ?? null;
  const region = ((campaign as any)?.region as string | null) ?? null;
  const locationLabel = [city, state].filter(Boolean).join(", ") || "—";

  const campaignDate = ((campaign as any)?.campaign_date as string | null) ?? null;

  const briefPublic = ((campaign as any)?.brief_public as string | null) ?? null;
  const briefPrivate = ((campaign as any)?.brief_private as string | null) ?? null;

  const invitedSummary = getInvitedSummary(req);

  const quoteTotal = typeof req?.quote_total === "number" ? req.quote_total : req?.quote_total ? Number(req.quote_total) : null;
  const quoteSubtotal = typeof req?.quote_subtotal === "number" ? req.quote_subtotal : req?.quote_subtotal ? Number(req.quote_subtotal) : null;
  const quoteDiscount = typeof req?.quote_discount === "number" ? req.quote_discount : req?.quote_discount ? Number(req.quote_discount) : null;

  const selectedCreatorIds: string[] = Array.isArray(req?.selected_creator_ids)
    ? req.selected_creator_ids.filter((x: any) => typeof x === "string" && x.trim().length > 0)
    : [];

  const creatorsCount =
    typeof req?.creators_needed === "number" ? req.creators_needed : req?.creators_needed ? Number(req.creators_needed) : null;

  const contractorRequirementsEntries = Object.entries(req || {}).filter(([k]) => k !== "selected_creator_ids");
  const otherEntries = contractorRequirementsEntries.filter(([k]) => !VALUE_KEYS.has(k));

  const creatorsToRender = Array.from(
    new Set([...(selectedCreatorIds || []), ...(participants.map((p) => p.influencer_id) || [])])
  );

  return (
    <MobileLayout title={campaign.title} showBack backTo={backTo} navType={navType} showNav={false} showHome homeRoute={backTo}>
      <div className="px-6 py-6 space-y-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
              {(campaign as any)?.type || "campanha"}
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

          {isInvitedInfluencer ? (
            <p className="text-xs text-muted-foreground mt-1">
              Você vê um resumo. Ao confirmar participação, você libera briefing completo, instruções e arquivos.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Detalhes da campanha.</p>
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
                Após confirmar, você verá legenda/hashtags/menções e poderá enviar suas entregas.
              </p>
            </div>
          )}
        </motion.div>

        {isContractor && (
          <div className="glass-card p-2 flex items-center gap-2">
            <button
              onClick={() => setTabWithUrl("details")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                tab === "details" ? "bg-primary/12 text-primary border border-primary/25" : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Detalhes
            </button>

            <button
              onClick={() => setTabWithUrl("files")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                tab === "files" ? "bg-primary/12 text-primary border border-primary/25" : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Paperclip className="w-3.5 h-3.5" />
              Arquivos
            </button>
          </div>
        )}

        {isContractor && tab === "files" && (
          <CampaignFilesTab campaignId={String(id)} role="contractor" influencerAccepted={false} readOnly />
        )}

        {tab === "details" && (
          <>
            {/* Local & Data */}
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

            {/* Resumo (invited) */}
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
                        Formato: <b className="text-foreground">{formatLabel(invitedSummary.format || null)}</b>
                      </span>

                      <span className="text-[10px] px-2 py-1 rounded-full border border-border/50 bg-card/60 text-muted-foreground inline-flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Creators: <b className="text-foreground">{typeof invitedSummary.creatorsNeeded === "number" ? invitedSummary.creatorsNeeded : "—"}</b>
                      </span>
                    </div>

                    {invitedSummary.segments.length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Segmentos: <span className="text-foreground/90 font-medium">{invitedSummary.segments.join(", ")}</span>
                      </div>
                    )}

                    <div className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 mt-0.5" />
                      <div>
                        Para proteger o processo, detalhes como <b>legenda, hashtags, menções, briefing completo e arquivos</b> só aparecem após confirmar participação.
                      </div>
                    </div>
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

            {/* Valores (contractor) */}
            {isContractor && (
              <div className="glass-card p-4 border border-primary/15">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Valores</p>
                    <p className="text-xs text-muted-foreground mt-1">Resumo financeiro da campanha</p>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary font-medium">
                    {formatMoneyBRL(quoteTotal)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
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
                    <div className="mt-1 text-sm font-semibold text-foreground">{creatorsCount ?? "—"}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Creators selecionados + confirmações */}
            {isContractor && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold text-foreground text-sm">Creators selecionados</h4>
                </div>

                <div className="glass-card p-4">
                  <p className="text-xs text-muted-foreground">
                    Aqui você valida as entregas de cada creator. Isso <b className="text-foreground">não conclui a campanha</b>, apenas a participação individual.
                  </p>

                  <div className="mt-3 space-y-2">
                    {creatorsToRender.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Nenhum creator encontrado.</div>
                    ) : (
                      creatorsToRender.map((creatorId) => {
                        const prof = creatorProfiles[creatorId];
                        const name = (prof?.display_name || prof?.name || "Creator").trim();
                        const ig = normalizeAt(prof?.instagram) || null;

                        const p = participants.find((x) => x.influencer_id === creatorId);
                        const pStatus = p?.status || null;

                        const d = deliverablesMap[creatorId] || null;
                        const dBadge = deliverableStatusLabel((d?.status as any) || null);

                        const confirmations = extractConfirmations(d);
                        const links = extractLinks(d);

                        const canApprove = d?.status === "submitted" || d?.status === "changes_requested";
                        const isBusy = approvingCreatorId === creatorId;

                        const checkedCount = confirmations.filter((c) => c.done).length;
                        const totalCount = confirmations.length;

                        return (
                          <div key={creatorId} className="rounded-2xl border border-border/50 bg-white/5 p-3 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-foreground truncate">{name}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {ig ? `${ig} · ` : ""}
                                  Participação: <span className="text-foreground/80">{pStatus || "—"}</span>
                                </div>

                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span className={`text-[10px] px-2 py-1 rounded-full border ${dBadge.cls}`}>Entregas: {dBadge.text}</span>
                                  {pStatus === "approved" && (
                                    <span className="text-[10px] px-2 py-1 rounded-full border border-accent/30 bg-accent/10 text-accent inline-flex items-center gap-1">
                                      <BadgeCheck className="w-3 h-3" />
                                      Aprovado
                                    </span>
                                  )}
                                  {totalCount > 0 && (
                                    <span className="text-[10px] px-2 py-1 rounded-full border border-border/50 bg-card/60 text-muted-foreground">
                                      Confirmações: <b className="text-foreground">{checkedCount}</b>/{totalCount}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <button
                                onClick={() => approveCreator(creatorId)}
                                disabled={!canApprove || isBusy}
                                className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                                  canApprove
                                    ? "border-accent/30 bg-accent/10 text-accent hover:bg-accent/15"
                                    : "border-border/50 bg-card/60 text-muted-foreground"
                                } disabled:opacity-60`}
                                title={
                                  canApprove
                                    ? "Aprovar participação do creator"
                                    : "O creator precisa enviar as entregas para revisão antes de aprovar"
                                }
                              >
                                {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : canApprove ? "Aprovar" : "Aguardando"}
                              </button>
                            </div>

                            {/* Confirmações (o bloco que “sumiu”) */}
                            {confirmations.length > 0 ? (
                              <div className="rounded-2xl border border-border/50 bg-card/60 p-3">
                                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Confirmações do creator</div>
                                <div className="space-y-1.5">
                                  {confirmations.map((c) => (
                                    <div key={c.key} className="flex items-center gap-2 text-sm">
                                      {c.done ? (
                                        <CheckSquare className="w-4 h-4 text-accent" />
                                      ) : (
                                        <Square className="w-4 h-4 text-muted-foreground" />
                                      )}
                                      <span className={c.done ? "text-foreground/85" : "text-muted-foreground"}>{c.label}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-2xl border border-border/40 bg-card/40 p-3 text-xs text-muted-foreground">
                                Nenhuma confirmação foi registrada ainda (ou a tabela não possui esse campo).
                              </div>
                            )}

                            {/* Links (se existirem) */}
                            {links.length > 0 && (
                              <div className="rounded-2xl border border-border/50 bg-card/60 p-3">
                                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Links de comprovação</div>
                                <div className="space-y-1.5">
                                  {links.slice(0, 5).map((url, idx) => (
                                    <a
                                      key={idx}
                                      href={url}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                      className="text-xs text-primary underline inline-flex items-center gap-2 break-all"
                                    >
                                      <LinkIcon className="w-3.5 h-3.5" />
                                      {url}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            {d?.status === "changes_requested" && (
                              <div className="flex items-center gap-2 text-xs text-warning">
                                <XCircle className="w-4 h-4" />
                                Ajustes solicitados — aguarde novo envio do creator.
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Conteúdo sensível bloqueado para invited */}
            {!isInvitedInfluencer && (
              <>
                {isContractor && !!briefPrivate && (
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

                {isContractor && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-primary" />
                      <h4 className="font-semibold text-foreground text-sm">Detalhes definidos na criação</h4>
                    </div>

                    <div className="glass-card p-4">
                      <div className="text-xs text-muted-foreground">Campos organizados (IDs ocultos). Para valores, veja o bloco “Valores”.</div>

                      <div className="mt-3 grid grid-cols-1 gap-2">
                        {otherEntries.map(([k, v]) => {
                          if (k === "selected_creator_ids") return null;
                          if (VALUE_KEYS.has(k)) return null;

                          if (Array.isArray(v) && v.filter(Boolean).length === 0) return null;

                          const label = REQUIREMENTS_LABELS[k] || humanizeKey(k);

                          const value =
                            k === "format"
                              ? formatLabel(String(v))
                              : k === "hashtags"
                                ? (Array.isArray(v) ? v.filter(Boolean).join(", ") : String(v))
                                : k === "mentions"
                                  ? (Array.isArray(v) ? v.filter(Boolean).join(", ") : String(v))
                                  : v;

                          return (
                            <div key={k} className="rounded-xl border border-border/50 bg-card/60 p-3">
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
                              <div className="mt-1 text-sm text-foreground/80 leading-relaxed">
                                {typeof value === "string" ? value || "—" : renderAny(value)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </MobileLayout>
  );
};

export default CampaignView;