import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
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

const statusUi: Record<ParticipantStatus, { label: string; cls: string; Icon: any }> = {
  invited: { label: "Convite", cls: "text-primary", Icon: Hourglass },
  confirmed: { label: "Ativa", cls: "text-accent", Icon: CheckCircle2 },
  delivered: { label: "Concluída", cls: "text-warning", Icon: Upload },
  approved: { label: "Concluída", cls: "text-accent", Icon: BadgeCheck },
};

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
                Aqui aparecem seus convites, campanhas ativas e concluídas.
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
                className={`px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  filter === t.key
                    ? "bg-primary/10 text-primary border border-primary/30"
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
              className="mt-4 px-4 py-2 rounded-xl border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground transition"
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
          <div className="space-y-3">
            {filtered.map((r, i) => {
              const ui = statusUi[r.participant_status];
              const isInvited = r.participant_status === "invited";
              const isConfirmingThis = confirmingId === r.campaign_id;

              return (
                <motion.div
                  key={`${r.campaign_id}-${r.participant_status}-${r.invited_at || ""}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.04 }}
                  className="glass-card-hover p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-foreground text-sm truncate">
                        {r.title || "Campanha"}
                      </h4>

                      <p className="text-xs text-muted-foreground mt-0.5">
                        {translateCampaignType(r.type)}
                      </p>

                      <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>
                          {r.city}, {r.state}
                        </span>
                      </div>
                    </div>

                    <div className={`flex items-center gap-1 shrink-0 ${ui.cls}`}>
                      <ui.Icon className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{ui.label}</span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="rounded-xl border border-border/50 bg-card/60 px-3 py-2">
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        Data do evento
                      </div>
                      <div className="text-sm font-semibold text-foreground mt-0.5">
                        {r.campaign_date ? formatDateBR(r.campaign_date) : "A definir"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
                    {isInvited ? (
                      <>
                        <button
                          onClick={() => handleOpenDetails(r)}
                          className="w-full py-2.5 rounded-xl border border-border/50 bg-card/60 text-foreground font-semibold text-xs flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver detalhes da campanha
                        </button>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => openDeclineModal(r)}
                            className="w-full py-2.5 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive font-semibold text-xs"
                          >
                            Recusar
                          </button>

                          <button
                            onClick={() => handleConfirmParticipation(r.campaign_id)}
                            disabled={isConfirmingThis}
                            className="w-full py-2.5 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-xs glow-blue disabled:opacity-60"
                          >
                            {isConfirmingThis ? "Confirmando..." : "Confirmar participação"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() => handleOpenDetails(r)}
                        className="w-full py-2.5 rounded-xl border border-accent/30 bg-accent/5 text-accent font-semibold text-xs flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Ver detalhes da campanha
                      </button>
                    )}
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
                className="w-full py-3 rounded-xl border border-border/50 text-muted-foreground font-medium text-sm"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleDeclineConfirmed}
                disabled={declining}
                className="w-full py-3 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm disabled:opacity-60"
              >
                {declining ? "Recusando..." : "Sim, recusar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileLayout>
  );
}