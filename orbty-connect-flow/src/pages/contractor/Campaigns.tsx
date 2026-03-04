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
  Tag,
  User2,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { MyCampaign } from "@/types/database";

type Bucket = "active" | "completed" | "all";

type MyCampaignRow = MyCampaign & {
  campaign_date?: string | null;
  created_at?: string | null;
  applicant_count?: number;
  bucket?: string;
  type?: string | null;
};

const pickDisplayName = (row: any): string | null => {
  if (!row) return null;

  // Campos comuns de "nome no perfil"
  const candidates = [
    row.display_name,
    row.full_name,
    row.name,
    row.username,
    row.nome,
    row.nome_publico,
    row.public_name,
    row.company_name,
    row.business_name,
  ];

  const found = candidates.find((v) => typeof v === "string" && v.trim().length > 0);
  return found ? String(found).trim() : null;
};

const ContractorCampaigns = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [campaigns, setCampaigns] = useState<MyCampaignRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bucket, setBucket] = useState<Bucket>("active");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [contractorName, setContractorName] = useState<string | null>(null);

  const formatDateBR = (value?: string | null) => {
    if (!value) return "-";
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const d = isDateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return isDateOnly
      ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" })
      : d.toLocaleDateString("pt-BR");
  };

  const fetchContractorName = useCallback(async () => {
    if (!user) return;

    // Tenta buscar de algumas tabelas conhecidas sem assumir colunas.
    // Como é o próprio usuário, normalmente RLS permite.
    const tries: Array<{
      table: "profiles" | "public_profiles" | "contractor_personal_data";
      // chaves comuns: profiles geralmente usa id, contractor_personal_data costuma usar user_id
      col: "id" | "user_id";
    }> = [
      { table: "profiles", col: "id" },
      { table: "public_profiles", col: "id" },
      { table: "contractor_personal_data", col: "user_id" },
    ];

    for (const t of tries) {
      const { data, error } = await supabase
        .from(t.table)
        .select("*")
        .eq(t.col, user.id)
        .maybeSingle();

      if (error) {
        // não interrompe, apenas tenta a próxima
        continue;
      }

      const name = pickDisplayName(data);
      if (name) {
        setContractorName(name);
        return;
      }
    }

    setContractorName(null);
  }, [user]);

  const fetchCampaigns = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    const { data, error } = await supabase.rpc("get_my_campaigns" as any, {
      p_bucket: "all",
    });

    if (!error && data) {
      // Excluídas não devem aparecer em nenhum lugar do front
      const rows = (data as unknown as MyCampaignRow[]).filter((c) => c.bucket !== "deleted");
      setCampaigns(rows);
    } else if (error) {
      console.error("GET_MY_CAMPAIGNS_ERROR", error);
      toast.error("Erro ao carregar campanhas.");
    }

    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCampaigns();
    fetchContractorName();
  }, [fetchCampaigns, fetchContractorName]);

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
    {
      label: "Ativas",
      value: String(groups.active.length),
      icon: Zap,
      tone: "text-primary",
      ring: "border-primary/25 bg-primary/10",
    },
    {
      label: "Concluídas",
      value: String(groups.completed.length),
      icon: BadgeCheck,
      tone: "text-accent",
      ring: "border-accent/25 bg-accent/10",
    },
    {
      label: "Total",
      value: String(groups.total),
      icon: TrendingUp,
      tone: "text-foreground",
      ring: "border-border/50 bg-card/60",
    },
  ];

  const tabs = [
    { key: "active" as const, label: `Ativas (${groups.active.length})` },
    { key: "completed" as const, label: `Concluídas (${groups.completed.length})` },
    { key: "all" as const, label: `Todas (${groups.total})` },
  ];

  const bucketTitle =
    bucket === "active"
      ? "Campanhas ativas"
      : bucket === "completed"
        ? "Campanhas concluídas"
        : "Todas as campanhas";

  const getStatusPill = (c: MyCampaignRow) => {
    if (c.bucket === "completed") {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full border border-accent/50 bg-accent/15 text-accent font-medium flex items-center gap-1">
          <BadgeCheck className="w-3 h-3" />
          Concluída
        </span>
      );
    }

    if (c.bucket === "closed_manual") {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-card/60 text-muted-foreground font-medium flex items-center gap-1">
          <Ban className="w-3 h-3" />
          Encerrada
        </span>
      );
    }

    if (c.bucket === "closed_expired") {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full border border-warning/30 bg-warning/10 text-warning font-medium flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Vencida
        </span>
      );
    }

    if (c.bucket === "draft") {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-card/60 text-muted-foreground font-medium">
          Rascunho
        </span>
      );
    }

    return null;
  };

  const menuItems = [
    {
      icon: Users,
      label: "Histórico",
      description: "Campanhas finalizadas e informações anteriores",
      route: "/historico",
    },
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
    };
    return map[t] ?? t;
  };

  return (
    <MobileLayout title="Minhas campanhas" navType="contractor">
      <div className="px-6 py-6 space-y-6">
        {/* Header premium */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-end justify-between gap-3"
        >
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-widest mb-1">
              Painel do contratante
            </p>
            <h2 className="font-display text-2xl font-bold text-foreground">
              Minhas <span className="text-gradient-neon">campanhas</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Gerencie suas campanhas com controle e clareza.
            </p>
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
            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="grid grid-cols-3 gap-3"
            >
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className={`glass-card p-4 flex flex-col items-center text-center gap-2 border ${stat.ring}`}
                >
                  <stat.icon className={`w-5 h-5 ${stat.tone}`} />
                  <span className="font-display font-bold text-xl text-foreground">{stat.value}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{stat.label}</span>
                </div>
              ))}
            </motion.div>

            {/* Dica */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.14 }}
              className="glass-card p-4 flex items-start gap-3"
            >
              <Sparkles className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-foreground font-medium">Dica inteligente:</span>{" "}
                Campanhas regionais têm 3x mais engajamento.
              </p>
            </motion.div>

            {/* Tabs */}
            <div className="glass-card p-2 flex items-center gap-2">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setBucket(t.key)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                    bucket === t.key
                      ? "bg-primary/12 text-primary border border-primary/25"
                      : "bg-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Lista */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
                  {bucketTitle}
                </p>

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
                  <button
                    onClick={() => navigate("/criar-campanha")}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border/50 text-xs text-foreground hover:border-primary/30 transition-colors"
                  >
                    <Plus className="w-4 h-4 text-primary" />
                    Criar campanha
                  </button>
                </div>
              ) : (
                sortedList.map((campaign, i) => {
                  const isBusy = updatingId === campaign.id;
                  const eventDate = campaign.campaign_date ?? null;

                  const typeLabel = niceType(campaign.type);
                  const locationLabel =
                    campaign.city && campaign.state ? `${campaign.city} · ${campaign.state}` : `${campaign.city || ""}${campaign.state ? ` · ${campaign.state}` : ""}`.trim();

                  return (
                    <motion.div
                      key={campaign.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 + i * 0.05 }}
                      className="glass-card-hover p-4"
                    >
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-foreground text-sm truncate">
                              {campaign.title}
                            </h4>

                            {getStatusPill(campaign)}
                          </div>

                          {/* Subtítulo premium: nome do perfil do contratante */}
                          {contractorName && (
                            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                              <User2 className="w-3.5 h-3.5" />
                              Perfil: <span className="text-foreground/90 font-medium">{contractorName}</span>
                            </p>
                          )}

                          {/* Meta chips */}
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            {typeLabel && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border border-border/50 bg-card/60 text-muted-foreground">
                                <Tag className="w-3 h-3" />
                                {typeLabel}
                              </span>
                            )}

                            {locationLabel && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border border-border/50 bg-card/60 text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                {locationLabel}
                              </span>
                            )}

                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border border-border/50 bg-card/60 text-muted-foreground">
                              <Users className="w-3 h-3" />
                              {campaign.applicant_count ?? 0} candidatura(s)
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => navigate(`/campanha/${campaign.id}`)}
                          className="text-muted-foreground hover:text-primary transition-colors"
                          title="Abrir campanha"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Info blocks */}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-border/50 bg-card/60 px-3 py-2">
                          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            Data do evento
                          </div>
                          <div className="text-sm font-semibold text-foreground mt-0.5">
                            {eventDate ? formatDateBR(eventDate) : "A definir"}
                          </div>
                        </div>

                        <div className="rounded-xl border border-border/50 bg-card/60 px-3 py-2">
                          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            <CheckCircle2 className="w-3 h-3" />
                            Status
                          </div>
                          <div className="text-sm font-semibold text-foreground mt-0.5">
                            {campaign.bucket === "active"
                              ? "Em andamento"
                              : campaign.bucket === "completed"
                                ? "Concluída"
                                : campaign.bucket === "closed_manual"
                                  ? "Encerrada"
                                  : campaign.bucket === "closed_expired"
                                    ? "Vencida"
                                    : campaign.bucket === "draft"
                                      ? "Rascunho"
                                      : "—"}
                          </div>
                        </div>
                      </div>

                      {/* CTAs */}
                      <div className="mt-3 pt-3 border-t border-border/30 flex gap-2">
                        <button
                          onClick={() => navigate(`/campanha/${campaign.id}`)}
                          className="flex-1 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary font-semibold text-xs hover:bg-primary/12 transition-colors"
                        >
                          Abrir campanha
                        </button>

                        {(campaign.bucket === "active" ||
                          campaign.bucket === "closed_manual" ||
                          campaign.bucket === "closed_expired") && (
                          <button
                            onClick={() => runAction(campaign.id, "complete")}
                            disabled={isBusy}
                            className="flex-1 py-2.5 rounded-xl border border-accent/30 bg-accent/10 text-accent font-semibold text-xs disabled:opacity-60"
                            title="Concluir (exige confirmação)"
                          >
                            Concluir
                          </button>
                        )}

                        <button
                          onClick={() => runAction(campaign.id, "delete")}
                          disabled={isBusy}
                          className="w-11 py-2.5 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive font-semibold text-xs flex items-center justify-center disabled:opacity-60"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Menu inferior */}
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