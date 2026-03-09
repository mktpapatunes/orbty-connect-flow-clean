import { useEffect, useMemo, useState } from "react";
import { Loader2, Star, X, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type ReviewableCampaign = {
  campaign_id: string;
  campaign_title: string;
  approved_at: string | null;
  already_reviewed: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  influencerId: string;
  influencerName?: string | null;
  preselectedCampaignId?: string | null;
  onSubmitted?: () => Promise<void> | void;
};

export default function RateCreatorModal({
  open,
  onClose,
  influencerId,
  influencerName,
  preselectedCampaignId,
  onSubmitted,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [campaigns, setCampaigns] = useState<ReviewableCampaign[]>([]);
  const [campaignId, setCampaignId] = useState<string>("");
  const [rating, setRating] = useState<number>(5);

  useEffect(() => {
    if (!open || !influencerId) return;

    let mounted = true;

    const run = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("list_reviewable_creator_campaigns", {
          p_influencer_id: influencerId,
        });

        if (error) throw error;

        const rows = ((data || []) as ReviewableCampaign[]).filter((r) => !r.already_reviewed);

        if (!mounted) return;

        setCampaigns(rows);

        if (preselectedCampaignId && rows.some((r) => r.campaign_id === preselectedCampaignId)) {
          setCampaignId(preselectedCampaignId);
        } else {
          setCampaignId(rows[0]?.campaign_id || "");
        }
      } catch (e: any) {
        console.error("LIST_REVIEWABLE_CREATOR_CAMPAIGNS_ERROR", e);
        toast.error(e?.message || "Erro ao carregar campanhas para avaliação.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [open, influencerId, preselectedCampaignId]);

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.campaign_id === campaignId) || null,
    [campaigns, campaignId]
  );

  const handleSubmit = async () => {
    if (!campaignId) {
      toast.error("Selecione uma campanha.");
      return;
    }

    if (rating < 1 || rating > 5) {
      toast.error("Selecione uma nota de 1 a 5.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("submit_campaign_review", {
        p_campaign_id: campaignId,
        p_influencer_id: influencerId,
        p_rating: rating,
      });

      if (error) throw error;

      toast.success("Avaliação enviada com sucesso.");
      await onSubmitted?.();
      onClose();
    } catch (e: any) {
      console.error("SUBMIT_CAMPAIGN_REVIEW_ERROR", e);
      toast.error(e?.message || "Erro ao enviar avaliação.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          className="w-full max-w-[520px] rounded-3xl border border-border/50 bg-background/95 shadow-2xl overflow-hidden"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-5 pt-5 pb-4 border-b border-border/40">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground uppercase tracking-widest">
                  Avaliar creator
                </div>
                <div className="mt-1 text-lg font-bold text-foreground truncate">
                  {influencerName || "Creator"}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="w-10 h-10 rounded-2xl border border-border/50 bg-card/60 hover:bg-card/80 transition flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0 disabled:opacity-60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="rounded-2xl border border-border/50 bg-card/60 p-4 text-sm text-muted-foreground">
                Não existem campanhas concluídas pendentes de avaliação para este creator.
              </div>
            ) : (
              <>
                <div>
                  <div className="text-sm font-semibold text-foreground mb-2">Campanha</div>
                  <select
                    value={campaignId}
                    onChange={(e) => setCampaignId(e.target.value)}
                    disabled={submitting}
                    className="w-full rounded-2xl border border-border/50 bg-card/60 px-4 py-3 text-sm text-foreground focus:outline-none"
                  >
                    {campaigns.map((c) => (
                      <option key={c.campaign_id} value={c.campaign_id}>
                        {c.campaign_title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-sm font-semibold text-foreground mb-2">Nota</div>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = n <= rating;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRating(n)}
                          disabled={submitting}
                          className="w-11 h-11 rounded-2xl border border-border/50 bg-card/60 flex items-center justify-center hover:bg-card/80 transition disabled:opacity-60"
                        >
                          <Star className={`w-5 h-5 ${active ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedCampaign && (
                  <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 text-xs text-muted-foreground">
                    Esta avaliação ficará vinculada à campanha{" "}
                    <span className="text-foreground font-semibold">{selectedCampaign.campaign_title}</span>.
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!campaignId || submitting}
                  className="w-full min-h-[46px] rounded-2xl bg-gradient-neon text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <BadgeCheck className="w-4 h-4" />
                  )}
                  {submitting ? "Enviando..." : "Enviar avaliação"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}