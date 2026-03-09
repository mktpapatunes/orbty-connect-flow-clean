import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import {
  Plus,
  Users,
  ArrowRight,
  Sparkles,
  Loader2,
  Calendar,
  BadgeCheck,
  Ban,
  AlertTriangle,
  Trash2,
  Zap,
  TrendingUp,
  MapPin,
  Store,
  RefreshCw,
  Building2,
  ClipboardCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { MyCampaign } from "@/types/database";

type Bucket = "active" | "completed" | "all";

type MyCampaignRow = MyCampaign & {
  campaign_date?: string | null;
  created_at?: string | null;
  bucket?: string;
  type?: string | null;
};

type BusinessInfo = {
  name: string | null;
  logo_url: string | null;
};

type CampaignParticipantStats = {
  total: number;
  confirmed: number;
  delivered: number;
  approved: number;
};

const ContractorCampaigns = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [campaigns, setCampaigns] = useState<MyCampaignRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bucket, setBucket] = useState<Bucket>("active");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    name: null,
    logo_url: null,
  });

  const [selectedCounts, setSelectedCounts] = useState<Record<string, number>>({});
  const [participantStats, setParticipantStats] = useState<Record<string, CampaignParticipantStats>>({});

  const formatDateBR = (value?: string | null) => {
    if (!value) return "-";
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const d = isDateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return isDateOnly
      ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" })
      : d.toLocaleDateString("pt-BR");
  };

  const initials = (name?: string | null) => {
    const n = String(name || "").trim();
    if (!n) return "M";
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };

  const fetchBusinessInfo = useCallback(async () => {
    if (!user) return;

    const linkCols: Array<"created_by" | "owner_id" | "user_id"> = ["created_by", "owner_id", "user_id"];

    for (const col of linkCols) {
      const { data, error } = await supabase
        .from("organizations")
        .select("name,logo_url")
        .eq(col as any, user.id)
        .order("created_at" as any, { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) continue;

      const name = typeof (data as any)?.name === "string" ? (data as any).name.trim() : null;
      const logo_url = typeof (data as any)?.logo_url === "string" ? (data as any).logo_url.trim() : null;

      if (name || logo_url) {
        setBusinessInfo({
          name: name || null,
          logo_url: logo_url || null,
        });
        return;
      }
    }

    setBusinessInfo({
      name: null,
      logo_url: null,
    });
  }, [user]);

  const fetchCampaigns = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    const { data, error } = await supabase.rpc("get_my_campaigns" as any, {
      p_bucket: "all",
    });

    if (!error && data) {
      const rows = (data as unknown as MyCampaignRow[]).filter((c) => c.bucket !== "deleted");
      setCampaigns(rows);
    } else if (error) {
      console.error("GET_MY_CAMPAIGNS_ERROR", error);
      toast.error("Erro ao carregar campanhas.");
    }

    setIsLoading(false);
  }, [user]);

  const fetchSelectedCreatorsCounts = useCallback(
    async (rows: MyCampaignRow[]) => {
      if (!user) return;

      const ids = rows.map((c) => c.id).filter(Boolean);
      if (ids.length === 0) {
        setSelectedCounts({});
        return;
      }

      const attempt1 = async (): Promise<Record<string, number> | null> => {
        const { data, error } = await supabase
          .from("campaign_applications")
          .select("campaign_id,status")
          .in("campaign_id", ids as any)
          .eq("status", "accepted");

        if (error) return null;

        const map: Record<string, number> = {};
        for (const r of data ?? []) {
          const cid = (r as any).campaign_id as string | undefined;
          if (!cid) continue;
          map[cid] = (map[cid] ?? 0) + 1;
        }

        return map;
      };

      const fallbackTables: Array<{ table: string; campaignIdCol: string }> = [
        { table: "campaign_selected_creators", campaignIdCol: "campaign_id" },
        { table: "campaign_creators", campaignIdCol: "campaign_id" },
        { table: "campaign_participants", campaignIdCol: "campaign_id" },
        { table: "campaign_influencers", campaignIdCol: "campaign_id" },
        { table: "campaign_selected_influencers", campaignIdCol: "campaign_id" },
      ];

      const attemptFallback = async (): Promise<Record<string, number> | null> => {
        for (const t of fallbackTables) {
          const { data, error } = await supabase
            .from(t.table as any)
            .select(`${t.campaignIdCol}`)
            .in(t.campaignIdCol as any, ids as any);

          if (error) continue;

          const map: Record<string, number> = {};
          for (const r of data ?? []) {
            const cid = (r as any)[t.campaignIdCol] as string | undefined;
            if (!cid) continue;
            map[cid] = (map[cid] ?? 0) + 1;
          }
          return map;
        }
        return null;
      };

      const map1 = await attempt1();
      const hasAny1 = map1 && Object.values(map1).some((n) => n > 0);

      if (hasAny1) {
        setSelectedCounts(map1!);
        return;
      }

      const map2 = await attemptFallback();
      const hasAny2 = map2 && Object.values(map2).some((n) => n > 0);

      if (hasAny2) {
        setSelectedCounts(map2!);
        return;
      }

      console.warn("SELECTED_CREATORS_COUNT: não encontrei fonte acessível/compatível.", { campaignIds: ids });
      setSelectedCounts({});
    },
    [user]
  );

  const fetchParticipantStats = useCallback(
    async (rows: MyCampaignRow[]) => {
      if (!user) return;

      const ids = rows.map((c) => c.id).filter(Boolean);
      if (ids.length === 0) {
        setParticipantStats({});
        return;
      }

      const { data, error } = await supabase
        .from("campaign_participants")
        .select("campaign_id,status")
        .in("campaign_id", ids as any);

      if (error) {
        console.error("FETCH_PARTICIPANT_STATS_ERROR", error);
        setParticipantStats({});
        return;
      }

      const map: Record<string, CampaignParticipantStats> = {};

      for (const row of data ?? []) {
        const campaignId = String((row as any).campaign_id || "");
        const status = String((row as any).status || "");

        if (!campaignId) continue;

        if (!map[campaignId]) {
          map[campaignId] = {
            total: 0,
            confirmed: 0,
            delivered: 0,
            approved: 0,
          };
        }

        map[campaignId].total += 1;

        if (status === "confirmed") map[campaignId].confirmed += 1;
        if (status === "delivered") map[campaignId].delivered += 1;
        if (status === "approved") map[campaignId].approved += 1;
      }

      setParticipantStats(map);
    },
    [user]
  );

  useEffect(() => {
    fetchCampaigns();
    fetchBusinessInfo();
  }, [fetchCampaigns, fetchBusinessInfo]);

  useEffect(() => {
    if (isLoading) return;
    fetchSelectedCreatorsCounts(campaigns);
    fetchParticipantStats(campaigns);
  }, [campaigns, fetchSelectedCreatorsCounts, fetchParticipantStats, isLoading]);

  const runAction = async (campaignId: string, action: "complete" | "delete") => {
    if (action === "complete") {
      const typed = window.prompt(
        "Concluir campanha é uma ação importante.\n\nConfirme APENAS se todas as entregas dos creators selecionados foram cumpridas.\n\nDigite CONCLUIR para confirmar:"
      );
      if ((typed || "").trim().toUpperCase() !== "CONCLUIR") {
        toast.message("Conclusão cancelada.");
        return;
      }
    }

    if (action === "delete") {
      const ok = window.confirm("Tem certeza que deseja excluir esta campanha? Ela será removida da sua lista.");
      if (!ok) return;
    }

    setUpdatingId(campaignId);

    try {
      const fn =
        action === "complete"
          ? "contractor_mark_campaign_completed"
          : "contractor_delete_campaign";

      const { error } = await supabase.rpc(fn as any, { p_campaign_id: campaignId });

      if (error) {
        const msg = (error.message || "").toLowerCase();
        const looksLikeCache =
          msg.includes("schema cache") || msg.includes("could not find the function") || msg.includes("does not exist");

        if (looksLikeCache) {
          toast.error(
            "Função ainda não apareceu no cache do Supabase. Supabase → Settings → API → Reload schema cache, ou hard refresh (Ctrl+Shift+R)."
          );
          console.error("RPC_SCHEMA_CACHE_ERROR", error);
          return;
        }
        throw error;
      }

      if (action === "complete") toast.success("Campanha marcada como concluída.");
      if (action === "delete") toast.success("Campanha excluída.");

      await fetchCampaigns();
    } catch (e: any) {
      console.error("CAMPAIGN_ACTION_ERROR", e);
      toast.error(e?.message || "Erro ao atualizar campanha.");
    } finally {
      setUpdatingId(null);
    }
  };

  const groups = useMemo(() => {
    const active = campaigns.filter((c) => c.bucket === "active");
    const completed = campaigns.filter((c) => c.bucket === "completed");
    const total = campaigns.length;
    return { active, completed, total };
  }, [campaigns]);

  const list = useMemo(() => {
    if (bucket === "active") return campaigns.filter((c) => c.bucket === "active");
    if (bucket === "completed") return campaigns.filter((c) => c.bucket === "completed");
    return campaigns;
  }, [bucket, campaigns]);

  const sortedList = useMemo(() => {
    const copy = [...list];
    copy.sort((a, b) => {
      const ac = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bc = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bc - ac;
    });
    return copy;
  }, [list]);

  const stats = [
    { label: "Ativas", value: String(groups.active.length), icon: Zap, tone: "text-primary", ring: "border-primary/25 bg-primary/10" },
    { label: "Concluídas", value: String(groups.completed.length), icon: BadgeCheck, tone: "text-accent", ring: "border-accent/25 bg-accent/10" },
    { label: "Total", value: String(groups.total), icon: TrendingUp, tone: "text-foreground", ring: "border-border/50 bg-card/60" },
  ];

  const tabs = [
    { key: "active" as const, label: `Ativas (${groups.active.length})` },
    { key: "completed" as const, label: `Concluídas (${groups.completed.length})` },
    { key: "all" as const, label: `Todas (${groups.total})` },
  ];

  const bucketTitle =
    bucket === "active" ? "Campanhas ativas" : bucket === "completed" ? "Campanhas concluídas" : "Todas as campanhas";

  const menuItems = [
    { icon: Users, label: "Histórico", description: "Campanhas finalizadas e informações anteriores", route: "/historico" },
  ];

  const niceType = (t?: string | null) => {
    if (!t) return null;
    const map: Record<string, string> = {
      music: "Música",
      food: "Gastronomia",
      beauty: "Beleza",
      fashion: "Moda",
      fitness: "Fitness",
      tech: "Tech",
      travel: "Viagem",
      other: "Outro",
      event: "Evento",
      product: "Produto/Serviço",
    };
    return map[t] ?? t;
  };

  const campaignVisualStatus = (c: MyCampaignRow, stats: CampaignParticipantStats | null) => {
    if (c.bucket === "completed") {
      return {
        label: "Concluída",
        helper: "Campanha finalizada",
        chip: "border-accent/30 bg-accent/10 text-accent",
        line: "bg-accent",
        Icon: BadgeCheck,
        step: 4,
      };
    }

    if (c.bucket === "closed_manual") {
      return {
        label: "Encerrada",
        helper: "Encerrada manualmente",
        chip: "border-border/50 bg-card/60 text-muted-foreground",
        line: "bg-muted-foreground",
        Icon: Ban,
        step: 3,
      };
    }

    if (c.bucket === "closed_expired") {
      return {
        label: "Vencida",
        helper: "Prazo encerrado",
        chip: "border-warning/30 bg-warning/10 text-warning",
        line: "bg-warning",
        Icon: AlertTriangle,
        step: 3,
      };
    }

    if (c.bucket === "draft") {
      return {
        label: "Rascunho",
        helper: "Ainda não publicada",
        chip: "border-border/50 bg-card/60 text-muted-foreground",
        line: "bg-muted-foreground",
        Icon: Store,
        step: 1,
      };
    }

    const deliveredCount = stats?.delivered ?? 0;
    const approvedCount = stats?.approved ?? 0;
    const totalCount = stats?.total ?? 0;

    if (deliveredCount > 0) {
      return {
        label: "Aguardando confirmação",
        helper: `Há ${deliveredCount} entrega(s) aguardando sua confirmação`,
        chip: "border-warning/30 bg-warning/10 text-warning",
        line: "bg-warning",
        Icon: ClipboardCheck,
        step: 3,
      };
    }

    if (approvedCount > 0 && approvedCount < totalCount) {
      return {
        label: "Entregas parciais",
        helper: `${approvedCount} creator(s) já confirmado(s)`,
        chip: "border-warning/30 bg-warning/10 text-warning",
        line: "bg-warning",
        Icon: ClipboardCheck,
        step: 3,
      };
    }

    if (approvedCount > 0 && totalCount > 0) {
      return {
        label: "Pronta para concluir",
        helper: "Todas as entregas foram confirmadas",
        chip: "border-warning/30 bg-warning/10 text-warning",
        line: "bg-warning",
        Icon: ClipboardCheck,
        step: 3,
      };
    }

    return {
      label: "Ativa",
      helper: "Campanha em andamento",
      chip: "border-primary/30 bg-primary/10 text-primary",
      line: "bg-primary",
      Icon: Zap,
      step: 2,
    };
  };

  const StatusRail = ({ step, line }: { step: number; line: string }) => {
    return (
      <div className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${i <= step ? line : "bg-border/60"}`}
          />
        ))}
      </div>
    );
  };

  return (
    <MobileLayout title="Minhas campanhas" navType="contractor">
      <div className="px-6 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-widest mb-1">Painel do contratante</p>
            <h2 className="font-display text-2xl font-bold text-foreground">
              Minhas <span className="text-gradient-neon">campanhas</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Gerencie suas campanhas com controle e clareza.</p>
          </div>

          <button
            onClick={() => navigate("/criar-campanha")}
            className="shrink-0 h-10 px-4 rounded-xl bg-gradient-neon text-primary-foreground text-xs font-semibold glow-blue flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nova
          </button>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="grid grid-cols-3 gap-3">
              {stats.map((stat) => (
                <div key={stat.label} className={`glass-card p-4 flex flex-col items-center text-center gap-2 border ${stat.ring}`}>
                  <stat.icon className={`w-5 h-5 ${stat.tone}`} />
                  <span className="font-display font-bold text-xl text-foreground">{stat.value}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{stat.label}</span>
                </div>
              ))}
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.14 }} className="glass-card p-4 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-foreground font-medium">Dica inteligente:</span> Campanhas regionais têm 3x mais engajamento.
              </p>
            </motion.div>

            <div className="glass-card p-2 flex items-center gap-2">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setBucket(t.key)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                    bucket === t.key ? "bg-primary/12 text-primary border border-primary/25" : "bg-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">{bucketTitle}</p>
                <button
                  onClick={fetchCampaigns}
                  className="inline-flex items-center gap-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  title="Atualizar lista"
                >
                  <RefreshCw className="w-3 h-3" />
                  Atualizar
                </button>
              </div>

              {sortedList.length === 0 ? (
                <div className="py-12 text-center glass-card">
                  <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma campanha nessa aba.</p>
                </div>
              ) : (
                sortedList.map((campaign, i) => {
                  const isBusy = updatingId === campaign.id;
                  const eventDate = campaign.campaign_date ?? null;

                  const typeLabel = niceType(campaign.type);
                  const locationLabel =
                    campaign.city && campaign.state
                      ? `${campaign.city}, ${campaign.state}`
                      : `${campaign.city || ""}${campaign.state ? `, ${campaign.state}` : ""}`.trim();

                  const statsForCampaign = participantStats[campaign.id] ?? null;
                  const selected = statsForCampaign?.total ?? selectedCounts[campaign.id] ?? 0;
                  const ui = campaignVisualStatus(campaign, statsForCampaign);

                  return (
                    <motion.div
                      key={campaign.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 + i * 0.05 }}
                      className="glass-card-hover p-4 overflow-hidden"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="shrink-0">
                              <div className="w-14 h-14 rounded-2xl border border-border/50 bg-card/60 overflow-hidden flex items-center justify-center">
                                {businessInfo.logo_url ? (
                                  <img
                                    src={businessInfo.logo_url}
                                    alt={businessInfo.name || "Marca"}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <span className="text-xs font-bold text-primary">
                                    {initials(businessInfo.name)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/50 bg-card/60 px-2.5 py-1 text-[10px] text-muted-foreground">
                                <Building2 className="w-3 h-3 shrink-0" />
                                <span className="truncate max-w-[180px]">
                                  {businessInfo.name || "Marca/Negócio"}
                                </span>
                              </div>

                              <div className="mt-2 flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-foreground text-[15px] leading-snug">
                                  {campaign.title}
                                </h4>
                              </div>

                              <p className="text-xs text-muted-foreground mt-1">
                                {typeLabel || "Campanha"}
                              </p>
                            </div>
                          </div>

                          <div
                            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${ui.chip}`}
                          >
                            <ui.Icon className="w-3.5 h-3.5" />
                            <span>{ui.label}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-2xl border border-border/50 bg-card/60 px-3 py-3">
                            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              Local
                            </div>
                            <div className="text-sm font-semibold text-foreground mt-1 truncate">
                              {locationLabel || "—"}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-border/50 bg-card/60 px-3 py-3">
                            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              Data
                            </div>
                            <div className="text-sm font-semibold text-foreground mt-1">
                              {eventDate ? formatDateBR(eventDate) : "A definir"}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border/50 bg-card/60 px-3 py-3">
                          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            <Users className="w-3 h-3" />
                            Creators selecionados
                          </div>
                          <div className="text-sm font-semibold text-foreground mt-1">
                            {selected} creator(s)
                          </div>
                        </div>

                        <div className="space-y-2">
                          <StatusRail step={ui.step} line={ui.line} />

                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[11px] font-medium text-muted-foreground">
                              {ui.helper}
                            </p>

                            <span className="text-[11px] text-muted-foreground">
                              {campaign.created_at ? `Criada em ${formatDateBR(campaign.created_at)}` : ""}
                            </span>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-border/30 flex gap-2">
                          <button
                            onClick={() => navigate(`/campanha/${campaign.id}`)}
                            className="flex-1 min-h-[42px] py-2.5 rounded-2xl bg-primary/10 border border-primary/20 text-primary font-semibold text-sm hover:bg-primary/12 transition-colors"
                          >
                            Abrir campanha
                          </button>

                          {(campaign.bucket === "active" || campaign.bucket === "closed_manual" || campaign.bucket === "closed_expired") && (
                            <button
                              onClick={() => runAction(campaign.id, "complete")}
                              disabled={isBusy}
                              className="flex-1 min-h-[42px] py-2.5 rounded-2xl border border-accent/30 bg-accent/10 text-accent font-semibold text-sm disabled:opacity-60"
                              title="Concluir (exige confirmação)"
                            >
                              Concluir
                            </button>
                          )}

                          <button
                            onClick={() => runAction(campaign.id, "delete")}
                            disabled={isBusy}
                            className="w-11 min-h-[42px] py-2.5 rounded-2xl border border-destructive/30 bg-destructive/5 text-destructive font-semibold text-xs flex items-center justify-center disabled:opacity-60"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            <div className="space-y-3">
              {menuItems.map((item, i) => (
                <motion.button
                  key={item.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.22 + i * 0.08 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(item.route)}
                  className="w-full glass-card-hover p-5 flex items-center gap-4 text-left group"
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-neon-subtle flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground text-sm">{item.label}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </motion.button>
              ))}
            </div>
          </>
        )}
      </div>
    </MobileLayout>
  );
};

export default ContractorCampaigns;