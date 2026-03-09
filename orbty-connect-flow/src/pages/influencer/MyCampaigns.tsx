import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import PublicProfile from "@/pages/profile/PublicProfile";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Loader2,
  MapPin,
  Calendar,
  CheckCircle2,
  Hourglass,
  BadgeCheck,
  Upload,
  X,
  Eye,
  Sparkles,
  Building2,
} from "lucide-react";

type ParticipantStatus = "invited" | "confirmed" | "delivered" | "approved";

type MyCampaignRow = {
  campaign_id: string;
  title: string;
  type: string;
  state: string;
  city: string;
  campaign_date: string | null;
  apply_deadline: string | null;
  campaign_status: string;
  participant_status: ParticipantStatus;
  invited_at: string | null;
  confirmed_at: string | null;
  delivered_at: string | null;
  approved_at: string | null;
  contractor_id: string | null;
  contractor_name: string | null;
  contractor_logo_url: string | null;
};

type FilterKey = "all" | "invited" | "active" | "completed";

const formatDateBR = (value?: string | null) => {
  if (!value) return "-";
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = isDateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return isDateOnly
    ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : d.toLocaleDateString("pt-BR");
};

const translateCampaignType = (type?: string | null) => {
  const raw = String(type || "").trim().toLowerCase();

  if (raw === "music") return "Música";
  if (raw === "event") return "Evento";
  if (raw === "product") return "Produto/Serviço";

  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "Campanha";
};

const initials = (name?: string | null) => {
  const n = String(name || "").trim();
  if (!n) return "M";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const statusUi: Record<
  ParticipantStatus,
  {
    label: string;
    helper: string;
    chip: string;
    line: string;
    Icon: any;
  }
> = {
  invited: {
    label: "Convite",
    helper: "Aguardando sua confirmação",
    chip: "border-primary/30 bg-primary/10 text-primary",
    line: "bg-primary",
    Icon: Hourglass,
  },
  confirmed: {
    label: "Ativa",
    helper: "Participação confirmada",
    chip: "border-accent/30 bg-accent/10 text-accent",
    line: "bg-accent",
    Icon: CheckCircle2,
  },
  delivered: {
    label: "Entregue",
    helper: "Aguardando confirmação do contratante",
    chip: "border-warning/30 bg-warning/10 text-warning",
    line: "bg-warning",
    Icon: Upload,
  },
  approved: {
    label: "Concluída",
    helper: "Entrega aprovada",
    chip: "border-accent/30 bg-accent/10 text-accent",
    line: "bg-accent",
    Icon: BadgeCheck,
  },
};

function StatusRail({ status }: { status: ParticipantStatus }) {
  const steps: ParticipantStatus[] = ["invited", "confirmed", "delivered", "approved"];
  const currentIndex = steps.indexOf(status);

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {steps.map((step, idx) => {
        const active = idx <= currentIndex;
        return (
          <div
            key={step}
            className={`h-1.5 rounded-full transition-all ${
              active ? statusUi[status].line : "bg-border/60"
            }`}
          />
        );
      })}
    </div>
  );
}

export default function MyCampaigns() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [rows, setRows] = useState<MyCampaignRow[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [decliningRow, setDecliningRow] = useState<MyCampaignRow | null>(null);
  const [declining, setDeclining] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileContractorId, setProfileContractorId] = useState<string | null>(null);
  const [profileContractorName, setProfileContractorName] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  async function refetch() {
    if (!user) return;
    setIsLoading(true);

    const { data, error } = await supabase.rpc("get_influencer_campaigns_feed" as any);

    if (error) {
      console.error("GET_INFLUENCER_CAMPAIGNS_FEED_ERROR", error);
      setRows([]);
      setIsLoading(false);
      return;
    }

    setRows((data || []) as unknown as MyCampaignRow[]);
    setIsLoading(false);
  }

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const modalOpen = profileOpen || declineModalOpen;
    if (!modalOpen) return;

    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyTouchAction = document.body.style.touchAction;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.touchAction = prevBodyTouchAction;
    };
  }, [profileOpen, declineModalOpen]);

  const counts = useMemo(() => {
    const invited = rows.filter((r) => r.participant_status === "invited").length;
    const active = rows.filter((r) => r.participant_status === "confirmed").length;
    const completed = rows.filter(
      (r) => r.participant_status === "delivered" || r.participant_status === "approved"
    ).length;

    return {
      invited,
      active,
      completed,
      total: rows.length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "invited") return rows.filter((r) => r.participant_status === "invited");
    if (filter === "active") return rows.filter((r) => r.participant_status === "confirmed");
    if (filter === "completed") {
      return rows.filter(
        (r) => r.participant_status === "delivered" || r.participant_status === "approved"
      );
    }
    return rows;
  }, [rows, filter]);

  const tabs = [
    { key: "active" as const, label: `Ativas (${counts.active})` },
    { key: "invited" as const, label: `Convites (${counts.invited})` },
    { key: "completed" as const, label: `Concluídas (${counts.completed})` },
    { key: "all" as const, label: `Todas (${counts.total})` },
  ];

  const handleOpenDetails = (row: MyCampaignRow) => {
    if (row.participant_status === "invited") {
      navigate(`/campanha/${row.campaign_id}`);
      return;
    }

    navigate(`/campanha-detalhe/${row.campaign_id}`);
  };

  const resolveContractorProfileId = async (rawId?: string | null) => {
    const value = String(rawId || "").trim();
    if (!value) return null;

    // 1) se já for um organization.id, usa ele mesmo
    const { data: orgById, error: orgByIdError } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", value)
      .maybeSingle();

    if (!orgByIdError && orgById?.id) {
      return String(orgById.id);
    }

    // 2) se vier um user id dono de organization, resolve para organization.id
    const { data: orgByOwner, error: orgByOwnerError } = await supabase
      .from("organizations")
      .select("id")
      .eq("created_by", value)
      .maybeSingle();

    if (!orgByOwnerError && orgByOwner?.id) {
      return String(orgByOwner.id);
    }

    // 3) fallback final: mantém o valor original
    return value;
  };

  const handleOpenContractorProfile = async (
    contractorId?: string | null,
    contractorName?: string | null
  ) => {
    if (!contractorId || profileLoading) return;

    setProfileLoading(true);
    try {
      const resolvedId = await resolveContractorProfileId(contractorId);

      if (!resolvedId) {
        toast.error("Não foi possível abrir o perfil da marca.");
        setProfileLoading(false);
        return;
      }

      setProfileContractorId(resolvedId);
      setProfileContractorName(contractorName || "Marca");
      setProfileOpen(true);
    } catch (e) {
      console.error("OPEN_CONTRACTOR_PROFILE_ERROR", e);
      toast.error("Não foi possível abrir o perfil da marca.");
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProfileModal = () => {
    if (profileLoading) return;
    setProfileOpen(false);
    setProfileContractorId(null);
    setProfileContractorName(null);
  };

  const handleConfirmParticipation = async (campaignId: string) => {
    if (!campaignId || !user || confirmingId) return;

    setConfirmingId(campaignId);

    const { error } = await supabase
      .from("campaign_participants")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      })
      .eq("campaign_id", campaignId)
      .eq("influencer_id", user.id);

    if (error) {
      console.error("CONFIRM_PARTICIPATION_CARD_ERROR", error);
      toast.error("Não foi possível confirmar participação.");
      setConfirmingId(null);
      return;
    }

    toast.success("Participação confirmada!");
    setConfirmingId(null);
    await refetch();
  };

  const openDeclineModal = (row: MyCampaignRow) => {
    setDecliningRow(row);
    setDeclineModalOpen(true);
  };

  const closeDeclineModal = () => {
    if (declining) return;
    setDecliningRow(null);
    setDeclineModalOpen(false);
  };

  const handleDeclineConfirmed = async () => {
    if (!decliningRow?.campaign_id) return;

    setDeclining(true);

    const { data, error } = await supabase.rpc("creator_decline_campaign" as any, {
      p_campaign_id: decliningRow.campaign_id,
    });

    if (error) {
      console.error("CREATOR_DECLINE_CAMPAIGN_ERROR", error);
      toast.error("Não foi possível recusar o convite.");
      setDeclining(false);
      return;
    }

    const ok = !!data?.ok;
    const message = String(data?.message || "");

    if (!ok) {
      toast.error(message || "Não foi possível recusar o convite.");
      setDeclining(false);
      return;
    }

    toast.success(message || "Convite recusado com sucesso.");
    setDeclining(false);
    closeDeclineModal();
    await refetch();
  };

  return (
    <MobileLayout title="Minhas campanhas" navType="influencer">
      <div className="px-6 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">
                Minhas <span className="text-gradient-neon">campanhas</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Acompanhe convites, entregas e aprovações em um só lugar.
              </p>
            </div>

            <button
              onClick={() => navigate("/minhas-candidaturas")}
              className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
              title="Ver histórico"
            >
              Histórico
            </button>
          </div>
        </motion.div>

        {!isLoading && rows.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`px-4 py-2.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  filter === t.key
                    ? "bg-primary/10 text-primary border border-primary/30 shadow-[0_0_0_1px_rgba(59,130,246,0.08)]"
                    : "bg-card text-muted-foreground border border-border/50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center">
            <Hourglass className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma campanha por aqui ainda.</p>
            <button
              onClick={() => navigate("/dashboard-influenciadora")}
              className="mt-4 px-4 py-2.5 rounded-xl border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground transition"
            >
              Voltar para o início
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Hourglass className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma campanha nessa aba.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((r, i) => {
              const ui = statusUi[r.participant_status];
              const isInvited = r.participant_status === "invited";
              const isConfirmingThis = confirmingId === r.campaign_id;
              const isDelivered = r.participant_status === "delivered";
              const isApproved = r.participant_status === "approved";

              return (
                <motion.div
                  key={`${r.campaign_id}-${r.participant_status}-${r.invited_at || ""}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.03 }}
                  className="glass-card-hover p-4 overflow-hidden"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenContractorProfile(r.contractor_id, r.contractor_name)
                          }
                          className="shrink-0"
                          title={r.contractor_name || "Ver perfil da marca"}
                          disabled={!r.contractor_id || profileLoading}
                        >
                          <div className="w-14 h-14 rounded-2xl border border-border/50 bg-card/60 overflow-hidden flex items-center justify-center">
                            {r.contractor_logo_url ? (
                              <img
                                src={r.contractor_logo_url}
                                alt={r.contractor_name || "Marca"}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span className="text-xs font-bold text-primary">
                                {initials(r.contractor_name)}
                              </span>
                            )}
                          </div>
                        </button>

                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenContractorProfile(r.contractor_id, r.contractor_name)
                            }
                            disabled={!r.contractor_id || profileLoading}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/50 bg-card/60 px-2.5 py-1 text-[10px] text-muted-foreground"
                          >
                            <Building2 className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[180px]">
                              {r.contractor_name || "Marca"}
                            </span>
                          </button>

                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-foreground text-[15px] leading-snug">
                              {r.title || "Campanha"}
                            </h4>

                            {isApproved && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                                <Sparkles className="w-3 h-3" />
                                Finalizada
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-muted-foreground mt-1">
                            {translateCampaignType(r.type)}
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
                          {r.city}, {r.state}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/50 bg-card/60 px-3 py-3">
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          Data
                        </div>
                        <div className="text-sm font-semibold text-foreground mt-1">
                          {r.campaign_date ? formatDateBR(r.campaign_date) : "A definir"}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <StatusRail status={r.participant_status} />

                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          {ui.helper}
                        </p>

                        {isDelivered ? (
                          <span className="text-[11px] text-muted-foreground">
                            Entregue em {r.delivered_at ? formatDateBR(r.delivered_at) : "—"}
                          </span>
                        ) : isApproved ? (
                          <span className="text-[11px] text-muted-foreground">
                            Confirmada em {r.approved_at ? formatDateBR(r.approved_at) : "—"}
                          </span>
                        ) : r.confirmed_at ? (
                          <span className="text-[11px] text-muted-foreground">
                            Confirmada em {formatDateBR(r.confirmed_at)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border/30 space-y-2">
                      {isInvited ? (
                        <>
                          <button
                            onClick={() => handleOpenDetails(r)}
                            className="w-full min-h-[42px] py-2.5 rounded-2xl border border-border/50 bg-card/60 text-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-card/80 transition"
                          >
                            <Eye className="w-4 h-4" />
                            Ver detalhes da campanha
                          </button>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => openDeclineModal(r)}
                              className="w-full min-h-[42px] py-2.5 rounded-2xl border border-destructive/20 bg-destructive/5 text-destructive font-semibold text-sm hover:bg-destructive/10 transition"
                            >
                              Recusar
                            </button>

                            <button
                              onClick={() => handleConfirmParticipation(r.campaign_id)}
                              disabled={isConfirmingThis}
                              className="w-full min-h-[42px] py-2.5 rounded-2xl bg-gradient-neon text-primary-foreground font-semibold text-sm glow-blue disabled:opacity-60"
                            >
                              {isConfirmingThis ? "Confirmando..." : "Confirmar participação"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          onClick={() => handleOpenDetails(r)}
                          className={`w-full min-h-[42px] py-2.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition ${
                            isDelivered
                              ? "border border-warning/25 bg-warning/10 text-warning hover:bg-warning/15"
                              : isApproved
                                ? "border border-accent/25 bg-accent/10 text-accent hover:bg-accent/15"
                                : "border border-accent/30 bg-accent/5 text-accent hover:bg-accent/10"
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {isDelivered
                            ? "Ver entrega enviada"
                            : isApproved
                              ? "Ver campanha concluída"
                              : "Ver detalhes da campanha"}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {declineModalOpen && decliningRow && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <div className="absolute inset-0 bg-black/60" onMouseDown={closeDeclineModal} />

          <div
            className="relative w-full md:max-w-md rounded-t-3xl md:rounded-3xl border border-border/50 bg-background p-5"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">Recusar convite</div>
              <button
                type="button"
                onClick={closeDeclineModal}
                className="p-2 rounded-xl hover:bg-white/5"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-sm text-foreground">
                Tem certeza que deseja recusar esta campanha?
              </p>
              <p className="text-xs text-muted-foreground">
                {decliningRow.title || "Campanha"}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={closeDeclineModal}
                disabled={declining}
                className="w-full min-h-[42px] py-2.5 rounded-2xl border border-border/50 text-muted-foreground font-medium text-sm"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleDeclineConfirmed}
                disabled={declining}
                className="w-full min-h-[42px] py-2.5 rounded-2xl bg-destructive text-destructive-foreground font-semibold text-sm disabled:opacity-60"
              >
                {declining ? "Recusando..." : "Sim, recusar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {profileOpen && profileContractorId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeProfileModal();
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
                      <div className="text-xs text-muted-foreground uppercase tracking-widest">
                        Perfil da marca
                      </div>
                      <div className="mt-1 text-lg font-bold text-foreground truncate">
                        {profileContractorName || "Marca"}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={closeProfileModal}
                      className="w-10 h-10 rounded-2xl border border-border/50 bg-card/60 hover:bg-card/80 transition flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y">
                  {profileLoading ? (
                    <div className="flex justify-center py-16">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                  ) : (
                    <PublicProfile
                      key={profileContractorId}
                      idOverride={profileContractorId}
                      embed
                      onBack={closeProfileModal}
                    />
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MobileLayout>
  );
}