import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import {
  MapPin,
  Calendar,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  History,
  BadgeCheck,
  Ban,
  Trash2,
  User as UserIcon,
  Filter,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Sparkles,
  ArrowLeft,
  Paperclip,
  Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { PublicCampaignFeed } from "@/types/database";
import CampaignFilesTab from "@/components/campaign/CampaignFilesTab";
import { toast } from "sonner";

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

type HistoryFilter = "all" | "applications" | "decisions" | "status";

type TimelineItem =
  | { kind: "event"; ev: CampaignTimelineRow }
  | {
      kind: "cluster";
      clusterType: "application.submitted" | "application.accepted" | "application.rejected";
      events: CampaignTimelineRow[];
      key: string;
    };

type RenderItem = { kind: "day"; key: string; label: string; isSearchMode?: boolean } | TimelineItem;

type SearchSuggestion = { key: string; label: string; value: string };

type TabKey = "details" | "history" | "files";

type ParticipantStatus = "invited" | "confirmed" | "delivered" | "approved";

const CampaignView = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { user, userRole, authReady } = useAuth();

  const [campaign, setCampaign] = useState<PublicCampaignFeed | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [tab, setTab] = useState<TabKey>("details");

  const [timeline, setTimeline] = useState<CampaignTimelineRow[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({});

  const [searchRaw, setSearchRaw] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [onlyTop, setOnlyTop] = useState(false);

  // ✅ status do convite/participação do usuário atual
  const [myParticipationStatus, setMyParticipationStatus] = useState<ParticipantStatus | null>(null);
  const [confirming, setConfirming] = useState(false);

  const isContractor = userRole === "contractor";
  const isInfluencer = userRole === "influencer";

  const goToPublicProfile = useCallback(
    (userId?: string | null) => {
      if (!userId) return;
      navigate(`/u/${userId}`);
    },
    [navigate]
  );

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

    const allowed: TabKey[] = ["details", "history", "files"];

    if (t && allowed.includes(t as TabKey)) {
      const next = t as TabKey;
      if (tab !== next) setTab(next);
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

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

  const normalizeAt = (handle?: string | null) => {
    if (!handle) return null;
    const h = handle.trim();
    if (!h) return null;
    return h.startsWith("@") ? h : `@${h}`;
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

  const normalizeSearch = (v: string) =>
    (v || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const highlight = (text: string, rawQuery: string) => {
    const q = (rawQuery || "").trim();
    if (!q) return text;

    const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "ig"));
    if (parts.length === 1) return text;

    return (
      <>
        {parts.map((p, idx) => {
          const isMatch = p.toLowerCase() === q.toLowerCase();
          return isMatch ? (
            <mark key={idx} className="rounded px-1 py-0.5 bg-primary/10 text-foreground border border-primary/15">
              {p}
            </mark>
          ) : (
            <span key={idx}>{p}</span>
          );
        })}
      </>
    );
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

  const dayKeyLocal = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "invalid";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfThatDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const diffMs = startOfToday.getTime() - startOfThatDay.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Ontem";
    return d.toLocaleDateString("pt-BR");
  };

  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchRaw.trim()), 180);
    return () => clearTimeout(t);
  }, [searchRaw]);

  const isSearchMode = useMemo(() => !!normalizeSearch(searchTerm), [searchTerm]);

  useEffect(() => {
    if (!isSearchMode) setOnlyTop(false);
  }, [isSearchMode]);

  const isContractorActionEvent = (t: CampaignTimelineRow) => {
    if (t.event_type === "application.accepted") return true;
    if (t.event_type === "application.rejected") return true;

    if (t.event_type === "campaign.status_changed") {
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

    if (t.event_type === "application.submitted") return ig ? `Candidatura enviada por ${name} (${ig})` : `Candidatura enviada por ${name}`;
    if (t.event_type === "application.accepted") return ig ? `Creator aprovado: ${name} (${ig})` : `Creator aprovado: ${name}`;
    if (t.event_type === "application.rejected") return ig ? `Creator recusado: ${name} (${ig})` : `Creator recusado: ${name}`;
    if (t.event_type === "campaign.status_changed") return `Status atualizado: ${statusLabel(t.from_status)} → ${statusLabel(t.to_status)}`;
    return "Evento";
  };

  const timelineSubFor = (t: CampaignTimelineRow) => {
    const when = formatDateTimeBR(t.created_at);

    if (isContractorActionEvent(t)) {
      const by = t.actor_name ? `por ${t.actor_name}` : "por contratante";
      if (t.event_type === "campaign.status_changed" && t.reason) return `${when} · ${by} · Motivo: ${t.reason}`;
      return `${when} · ${by}`;
    }

    if (t.event_type === "application.submitted") return t.note ? `${when} · Nota: "${t.note}"` : when;
    if (t.event_type === "campaign.status_changed" && t.reason) return `${when} · Motivo: ${t.reason}`;

    return when;
  };

  const scoreEventForQuery = (e: CampaignTimelineRow, qNormRaw: string) => {
    const qNorm = qNormRaw.trim();
    if (!qNorm) return 0;

    const inflName = normalizeSearch(e.influencer_name || "");
    const inflIg = normalizeSearch((normalizeAt(e.influencer_instagram) || "").replace("@", ""));
    const inflIgWithAt = normalizeSearch(normalizeAt(e.influencer_instagram) || "");
    const actorName = normalizeSearch(e.actor_name || "");

    const qNoAt = qNorm.startsWith("@") ? qNorm.slice(1) : qNorm;

    let score = 0;

    if (inflIgWithAt === qNorm) score += 120;
    if (inflIg === qNoAt) score += 110;
    if (inflIg.startsWith(qNoAt)) score += 85;
    if (inflIg.includes(qNoAt)) score += 65;

    if (inflName === qNorm) score += 90;
    if (inflName.startsWith(qNorm)) score += 60;
    if (inflName.includes(qNorm)) score += 35;

    if (actorName === qNorm) score += 50;
    if (actorName.startsWith(qNorm)) score += 30;
    if (actorName.includes(qNorm)) score += 18;

    if (score > 0) {
      if (e.event_type === "application.accepted") score += 8;
      if (e.event_type === "application.rejected") score += 6;
      if (e.event_type === "campaign.status_changed") score += 5;
    }

    return score;
  };

  const buildSuggestions = (events: CampaignTimelineRow[], qNorm: string): SearchSuggestion[] => {
    const q = qNorm.trim();
    if (!q) return [];

    const qNoAt = q.startsWith("@") ? q.slice(1) : q;
    const res: SearchSuggestion[] = [];
    const seen = new Set<string>();

    const push = (key: string, label: string, value: string) => {
      if (seen.has(key)) return;
      seen.add(key);
      res.push({ key, label, value });
    };

    for (const e of events) {
      const name = (e.influencer_name || "").trim();
      const at = normalizeAt(e.influencer_instagram);
      const atNo = at ? at.replace("@", "") : "";

      const nameNorm = normalizeSearch(name);
      const atNorm = normalizeSearch(atNo);

      const matchInfluencer =
        (name && (nameNorm.startsWith(q) || nameNorm.includes(q))) || (atNo && (atNorm.startsWith(qNoAt) || atNorm.includes(qNoAt)));

      if (matchInfluencer && (name || at)) {
        const label = `${name || "Creator"}${at ? ` · ${at}` : ""}`;
        const value = at ? at : name;
        push(`infl:${e.influencer_id || label}`, label, value);
      }

      const actor = (e.actor_name || "").trim();
      const actorNorm = normalizeSearch(actor);
      const matchActor = actor && (actorNorm.startsWith(q) || actorNorm.includes(q));
      if (matchActor) push(`actor:${e.actor_id || actor}`, actor, actor);

      if (res.length >= 6) break;
    }

    return res;
  };

  const baseFilteredByType = useMemo(() => {
    let arr = timeline || [];

    if (historyFilter === "applications") arr = arr.filter((e) => e.event_type === "application.submitted");
    else if (historyFilter === "decisions") arr = arr.filter((e) => e.event_type === "application.accepted" || e.event_type === "application.rejected");
    else if (historyFilter === "status") arr = arr.filter((e) => e.event_type === "campaign.status_changed");

    return arr;
  }, [timeline, historyFilter]);

  const filteredTimeline = useMemo(() => {
    const arr = baseFilteredByType;

    const q = normalizeSearch(searchTerm);
    if (!q) return arr;

    const scored = arr.map((e) => ({ e, score: scoreEventForQuery(e, q) })).filter((x) => x.score > 0);

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const bt = new Date(b.e.created_at).getTime();
      const at = new Date(a.e.created_at).getTime();
      return bt - at;
    });

    return scored.map((x) => x.e);
  }, [baseFilteredByType, searchTerm]);

  const suggestions = useMemo(() => buildSuggestions(baseFilteredByType, normalizeSearch(searchTerm)), [baseFilteredByType, searchTerm]);

  const topMatches = useMemo(() => (isSearchMode ? filteredTimeline.slice(0, 3) : []), [filteredTimeline, isSearchMode]);

  const resultsCount = useMemo(() => (isSearchMode ? filteredTimeline.length : (timeline || []).length), [filteredTimeline, isSearchMode, timeline]);

  const timelineItems: TimelineItem[] = useMemo(() => {
    const events = filteredTimeline || [];

    if (isSearchMode) return events.map((ev) => ({ kind: "event" as const, ev }));

    const items: TimelineItem[] = [];

    const isClusterable = (t: CampaignTimelineRow) =>
      t.event_type === "application.submitted" || t.event_type === "application.accepted" || t.event_type === "application.rejected";

    let i = 0;
    while (i < events.length) {
      const current = events[i];

      if (!isClusterable(current)) {
        items.push({ kind: "event", ev: current });
        i += 1;
        continue;
      }

      const clusterType = current.event_type as "application.submitted" | "application.accepted" | "application.rejected";
      const day = dayKeyLocal(current.created_at);

      const cluster: CampaignTimelineRow[] = [current];

      let j = i + 1;
      while (j < events.length) {
        const next = events[j];
        if (!isClusterable(next)) break;
        if (next.event_type !== clusterType) break;
        if (dayKeyLocal(next.created_at) !== day) break;

        if ((clusterType === "application.accepted" || clusterType === "application.rejected") && current.actor_id && next.actor_id) {
          if (current.actor_id !== next.actor_id) break;
        }

        cluster.push(next);
        j += 1;
      }

      if (cluster.length >= 2) {
        const key = `${cluster[0].event_id}-cluster`;
        items.push({ kind: "cluster", clusterType, events: cluster, key });
        i = j;
      } else {
        items.push({ kind: "event", ev: current });
        i += 1;
      }
    }

    return items;
  }, [filteredTimeline, isSearchMode]);

  useEffect(() => {
    if (isSearchMode) return;

    const auto: Record<string, boolean> = {};
    for (const item of timelineItems) {
      if (item.kind === "cluster" && item.events.length <= 2) auto[item.key] = true;
    }

    setExpandedClusters((prev) => {
      const next = { ...prev };
      let changed = false;

      for (const [k, v] of Object.entries(auto)) {
        if (typeof next[k] === "undefined") {
          next[k] = v;
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [timelineItems, isSearchMode]);

  const clusterTitle = (type: "application.submitted" | "application.accepted" | "application.rejected", count: number) => {
    if (type === "application.submitted") return `${count} novas candidaturas`;
    if (type === "application.accepted") return `${count} creators aprovados`;
    if (type === "application.rejected") return `${count} creators recusados`;
    return `${count} eventos`;
  };

  const clusterAccent = (type: "application.submitted" | "application.accepted" | "application.rejected") => {
    if (type === "application.accepted") return { bg: "bg-accent/10", text: "text-accent", border: "border-accent/25" };
    if (type === "application.rejected") return { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/25" };
    return { bg: "bg-primary/10", text: "text-primary", border: "border-primary/25" };
  };

  const timelineRenderItems: RenderItem[] = useMemo(() => {
    let items = timelineItems;

    if (isSearchMode && onlyTop) items = topMatches.map((ev) => ({ kind: "event" as const, ev }));

    const out: RenderItem[] = [];
    let lastDay: string | null = null;

    for (const item of items) {
      const firstDate = item.kind === "event" ? item.ev.created_at : item.events[0]?.created_at;
      const dk = dayKeyLocal(firstDate);

      if (dk !== lastDay) {
        out.push({ kind: "day", key: `day-${dk}`, label: dayLabel(firstDate), isSearchMode });
        lastDay = dk;
      }
      out.push(item);
    }

    return out;
  }, [timelineItems, isSearchMode, onlyTop, topMatches]);

  const fetchTimeline = useCallback(async () => {
    if (!id || !user) return;

    setTimelineLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_campaign_timeline" as any, { p_campaign_id: id });

      if (error) {
        const msg = (error.message || "").toLowerCase();
        const looksMissing = msg.includes("could not find the function") || msg.includes("does not exist") || msg.includes("schema cache");

        if (!looksMissing) console.error("GET_CAMPAIGN_TIMELINE_ERROR", error);

        setTimeline([]);
        return;
      }

      setTimeline((data || []) as unknown as CampaignTimelineRow[]);
    } finally {
      setTimelineLoading(false);
    }
  }, [id, user]);

  // ✅ confirmação REAL: muda campaign_participants.status -> confirmed
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

      // vai pro detalhe (onde não tem mais CTA de confirmar)
      navigate(`/campanha-detalhe/${id}`, { replace: true });
    } catch (e: any) {
      console.error("CONFIRM_PARTICIPATION_EXCEPTION", e);
      toast.error(e?.message || "Erro ao confirmar participação.");
    } finally {
      setConfirming(false);
    }
  }, [id, user, isInfluencer, navigate]);

  // ✅ FIX 2 (role-aware): contractor vê a própria; influencer vê se tiver participação
  useEffect(() => {
    const fetchData = async () => {
      if (!authReady || userRole === undefined) return;

      if (!id || !user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        // ===== CONTRACTOR =====
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

        // ===== INFLUENCER =====
        // 1) valida convite/participação
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

        // se já confirmou/entregou/aprovou -> manda pro detalhe
        if (pStatus && pStatus !== "invited") {
          navigate(`/campanha-detalhe/${id}`, { replace: true });
          return;
        }

        // 2) invited -> carrega campanha
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

  useEffect(() => {
    if (tab === "history") fetchTimeline();
  }, [tab, fetchTimeline]);

  const toggleCluster = (key: string) => setExpandedClusters((prev) => ({ ...prev, [key]: !prev[key] }));

  const clearSearch = () => {
    setSearchRaw("");
    setSearchTerm("");
    setOnlyTop(false);
    requestAnimationFrame(() => searchInputRef.current?.focus());
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

  const historyFilters = [
    { key: "all" as const, label: "Todas" },
    { key: "applications" as const, label: "Candidaturas" },
    { key: "decisions" as const, label: "Decisões" },
    { key: "status" as const, label: "Status" },
  ];

  const shouldShowInfluencerConfirmCta = isInfluencer && myParticipationStatus === "invited";

  return (
    <MobileLayout title={campaign.title} showBack backTo={backTo} navType={navType} showNav={false} showHome homeRoute={backTo}>
      <div className="px-6 py-6 space-y-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">{campaign.type}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">{(campaign as any)?.status || "—"}</span>
          </div>

          <h2 className="font-display text-2xl font-bold text-foreground">{campaign.title}</h2>

          {/* ✅ CTA do influencer para confirmar DE VERDADE */}
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
                Ao confirmar, a campanha sai de <span className="text-foreground font-medium">Convite</span> e vai para{" "}
                <span className="text-foreground font-medium">Confirmada</span>.
              </p>
            </div>
          )}
        </motion.div>

        {isContractor && (
          <div className="flex gap-2">
            <button
              onClick={() => setTabWithUrl("details")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${
                tab === "details" ? "bg-primary/10 text-primary border border-primary/30" : "bg-card text-muted-foreground border border-border/50"
              }`}
            >
              Detalhes
            </button>

            <button
              onClick={() => setTabWithUrl("history")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                tab === "history" ? "bg-primary/10 text-primary border border-primary/30" : "bg-card text-muted-foreground border border-border/50"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Histórico
            </button>

            <button
              onClick={() => setTabWithUrl("files")}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                tab === "files" ? "bg-primary/10 text-primary border border-primary/30" : "bg-card text-muted-foreground border border-border/50"
              }`}
            >
              <Paperclip className="w-3.5 h-3.5" />
              Arquivos
            </button>
          </div>
        )}

        {tab === "files" && <CampaignFilesTab campaignId={String(id)} role="contractor" influencerAccepted={false} />}

        {tab === "details" && (
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

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/50 bg-card/60 p-4 col-span-2">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-accent" />
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Data do evento</p>
                </div>
                <p className="text-sm font-semibold text-foreground">{campaign.campaign_date ? formatDateBR(campaign.campaign_date) : "A definir"}</p>
              </div>
            </motion.div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-primary" />
                <h4 className="font-semibold text-foreground text-sm">Descrição</h4>
              </div>
              <p className="text-sm text-foreground/70 leading-relaxed glass-card p-4">{campaign.brief_public}</p>
            </div>
          </>
        )}

        {tab === "history" && (
          <div className="space-y-3">
            <div className="glass-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">Linha do tempo</p>
                    <p className="text-xs text-muted-foreground">{isSearchMode ? "Resultados por relevância" : "Eventos e decisões"}</p>
                  </div>
                </div>

                <button onClick={fetchTimeline} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                  {timelineLoading ? "Atualizando..." : "Atualizar"}
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                  <Filter className="w-3 h-3" />
                  Filtrar:
                </div>

                {historyFilters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setHistoryFilter(f.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                      historyFilter === f.key ? "bg-primary/10 text-primary border border-primary/30" : "bg-card text-muted-foreground border border-border/50"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}

                <span className="ml-auto text-[10px] px-2 py-1 rounded-full border border-border/50 bg-card/60 text-muted-foreground whitespace-nowrap">
                  {isSearchMode ? `${resultsCount} resultado(s)` : `${timeline.length} evento(s)`}
                </span>
              </div>

              <div className="mt-3">
                <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/60 px-3 py-2">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <input
                    ref={searchInputRef}
                    value={searchRaw}
                    onChange={(e) => setSearchRaw(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") clearSearch();
                    }}
                    placeholder="Buscar por nome ou @..."
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                  />
                  {searchRaw.trim() && (
                    <button onClick={clearSearch} className="text-muted-foreground hover:text-foreground transition-colors" title="Limpar">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {isSearchMode && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={clearSearch}
                      className="px-3 py-2 rounded-xl text-xs font-medium border border-border/50 bg-card/60 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                      title="Limpar busca"
                    >
                      <X className="w-3.5 h-3.5" />
                      Limpar
                    </button>

                    <button
                      onClick={clearSearch}
                      className="px-3 py-2 rounded-xl text-xs font-medium border border-border/50 bg-card/60 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                      title="Voltar para ordem cronológica"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Cronológica
                    </button>

                    <button
                      onClick={() => setOnlyTop((v) => !v)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border bg-card/60 transition-colors flex items-center gap-1.5 ${
                        onlyTop ? "border-primary/30 text-primary" : "border-border/50 text-muted-foreground hover:text-foreground"
                      }`}
                      title="Alternar Top matches"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {onlyTop ? "Top" : "Todos"}
                    </button>

                    <div className="text-[10px] text-muted-foreground ml-auto">
                      Buscando: <span className="text-foreground font-medium">{searchTerm}</span>
                    </div>
                  </div>
                )}

                {isSearchMode && suggestions.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest shrink-0">Sugestões</span>

                    {suggestions.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setSearchRaw(s.value)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border border-border/50 bg-card/60 text-muted-foreground hover:text-foreground transition-colors"
                        title="Aplicar busca"
                      >
                        {highlight(s.label, searchTerm)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {timelineLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {timelineRenderItems.map((item) => {
                  if (item.kind === "day") {
                    return (
                      <div key={item.key} className="pt-2 pb-1 sticky top-0 z-10">
                        <div className="flex items-center gap-3 bg-background/80 backdrop-blur-xl py-1">
                          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">{item.label}</span>
                          <div className="h-px flex-1 bg-border/40" />
                        </div>
                      </div>
                    );
                  }

                  if (item.kind === "event") {
                    const ev = item.ev;
                    const Icon = timelineIconFor(ev);

                    const isPositive = ev.event_type === "application.accepted" || (ev.event_type === "campaign.status_changed" && ev.to_status === "completed");
                    const isNegative =
                      ev.event_type === "application.rejected" ||
                      (ev.event_type === "campaign.status_changed" && (ev.to_status === "deleted" || ev.to_status === "closed_expired"));

                    const avatarName = ev.event_type === "application.submitted" ? ev.influencer_name : ev.actor_name;
                    const titleRaw = timelineTitleFor(ev);

                    return (
                      <motion.div key={ev.event_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                              isPositive ? "bg-accent/10 border-accent/25" : isNegative ? "bg-destructive/10 border-destructive/25" : "bg-primary/10 border-primary/25"
                            }`}
                            title={avatarName || ""}
                          >
                            <span className={`text-xs font-bold ${isPositive ? "text-accent" : isNegative ? "text-destructive" : "text-primary"}`}>
                              {getInitials(avatarName)}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Icon className={`w-4 h-4 ${isPositive ? "text-accent" : isNegative ? "text-destructive" : "text-primary"}`} />
                              <p className="text-sm font-semibold text-foreground">{isSearchMode ? highlight(titleRaw, searchTerm) : titleRaw}</p>
                            </div>

                            <p className="text-xs text-muted-foreground mt-1">{timelineSubFor(ev)}</p>

                            {(ev.influencer_name || ev.influencer_instagram) && (
                              <button
                                type="button"
                                onClick={() => goToPublicProfile(ev.influencer_id)}
                                disabled={!ev.influencer_id}
                                className={`mt-2 inline-flex items-center gap-2 text-[10px] px-2 py-1 rounded-full border bg-card/60 ${
                                  ev.influencer_id ? "border-border/50 text-muted-foreground hover:text-foreground transition" : "border-border/30 text-muted-foreground/60 cursor-default"
                                }`}
                                title={ev.influencer_id ? "Ver perfil público" : ""}
                              >
                                <UserIcon className="w-3 h-3" />
                                <span className="truncate">
                                  {`${ev.influencer_name || "Creator"}${normalizeAt(ev.influencer_instagram) ? ` · ${normalizeAt(ev.influencer_instagram)}` : ""}`}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  }

                  const { clusterType, events, key } = item;
                  const accent = clusterAccent(clusterType);
                  const count = events.length;
                  const expanded = !!expandedClusters[key];

                  const actorName = events[0]?.actor_name || null;
                  const avatarText = clusterType === "application.submitted" ? `+${count}` : getInitials(actorName);

                  const title = clusterTitle(clusterType, count);
                  const subtitleBase = formatDateTimeBR(events[0]?.created_at);
                  const showBy = clusterType !== "application.submitted";
                  const byText = showBy ? (actorName ? ` · por ${actorName}` : " · por contratante") : "";

                  return (
                    <motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${accent.bg} ${accent.border}`}>
                          <span className={`text-xs font-bold ${accent.text}`}>{avatarText}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{title}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {subtitleBase}
                                {byText}
                              </p>
                            </div>

                            <button
                              onClick={() => toggleCluster(key)}
                              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                              title={expanded ? "Recolher" : "Ver detalhes"}
                            >
                              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>

                          <div className="mt-3">
                            {expanded ? (
                              <div className="space-y-2">
                                {events.map((ev) => {
                                  const name = ev.influencer_name || "Creator";
                                  const ig = normalizeAt(ev.influencer_instagram);
                                  const right = clusterType === "application.submitted" ? ig : null;

                                  return (
                                    <button
                                      key={ev.event_id}
                                      type="button"
                                      onClick={() => goToPublicProfile(ev.influencer_id)}
                                      disabled={!ev.influencer_id}
                                      className={`w-full text-left flex items-center justify-between gap-3 rounded-xl border bg-card/60 px-3 py-2 ${
                                        ev.influencer_id ? "border-border/50 hover:bg-card/80 transition" : "border-border/30 cursor-default"
                                      }`}
                                      title={ev.influencer_id ? "Ver perfil público" : ""}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent.bg}`}>
                                          <span className={`text-[10px] font-bold ${accent.text}`}>{getInitials(name)}</span>
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-semibold text-foreground truncate">{name}</p>
                                          <p className="text-[10px] text-muted-foreground">{formatDateTimeBR(ev.created_at)}</p>
                                        </div>
                                      </div>
                                      {right && <span className="text-xs text-muted-foreground shrink-0">{right}</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {events.slice(0, 3).map((ev) => {
                                  const name = ev.influencer_name || "Creator";
                                  const ig = normalizeAt(ev.influencer_instagram);
                                  const clickable = !!ev.influencer_id;

                                  return (
                                    <button
                                      key={ev.event_id}
                                      type="button"
                                      onClick={() => goToPublicProfile(ev.influencer_id)}
                                      disabled={!clickable}
                                      className={`text-[10px] px-2 py-1 rounded-full border bg-card/60 ${
                                        clickable
                                          ? "border-border/50 text-muted-foreground hover:text-foreground hover:bg-card/80 transition"
                                          : "border-border/30 text-muted-foreground/60 cursor-default"
                                      }`}
                                      title={ig ? `${name} (${ig})` : name}
                                    >
                                      {name}
                                      {ig ? ` · ${ig}` : ""}
                                    </button>
                                  );
                                })}
                                {events.length > 3 && (
                                  <span className="text-[10px] px-2 py-1 rounded-full border border-border/50 bg-card/60 text-muted-foreground">
                                    +{events.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
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
    </MobileLayout>
  );
};

export default CampaignView;