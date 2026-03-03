// src/pages/payment/PaymentSimulated.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, CheckCircle2, ArrowLeft, ShieldCheck } from "lucide-react";
import MobileLayout from "@/components/MobileLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCampaign } from "@/contexts/CampaignContext";

const STEP_STORAGE_KEY = "orbty:create_campaign:step:v1";

function formatBRL(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

type CampaignRow = {
  id: string;
  title: string | null;
  status: string | null;
  requirements: any;
  created_by?: string | null;
};

export default function PaymentSimulated() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { resetData } = useCampaign();

  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<CampaignRow | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let alive = true;

    if (!id) {
      navigate("/dashboard-contratante", { replace: true });
      return;
    }

    (async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("campaigns")
          .select("id,title,status,requirements,created_by")
          .eq("id", id)
          .single();

        if (!alive) return;

        if (error) {
          console.error("PAYMENT_FETCH_CAMPAIGN_ERROR", error);
          toast.error("Não foi possível carregar a campanha.");
          navigate("/dashboard-contratante", { replace: true });
          return;
        }

        setCampaign(data as any);
      } catch (e) {
        console.error("PAYMENT_FETCH_CAMPAIGN_EXCEPTION", e);
        if (!alive) return;
        toast.error("Erro ao carregar campanha.");
        navigate("/dashboard-contratante", { replace: true });
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id, navigate]);

  const quoteTotal = useMemo(() => {
    const raw = campaign?.requirements?.quote_total ?? campaign?.requirements?.quoteTotal ?? null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, [campaign]);

  const canSimulate = campaign?.status === "pending_payment";

  const simulatePayment = async () => {
    if (!id) return;
    if (!canSimulate) {
      toast.error("Esta campanha não está pendente de pagamento.");
      return;
    }

    setPaying(true);
    try {
      const { data, error } = await (supabase.rpc as any)("simulate_campaign_payment", {
        p_campaign_id: id,
      });

      if (error) {
        console.error("SIMULATE_PAYMENT_ERROR", error);
        toast.error(error.message || "Não foi possível simular o pagamento.");
        return;
      }

      const ok = !!data?.ok;
      if (!ok) {
        toast.error(data?.message || "Não foi possível simular o pagamento.");
        return;
      }

      toast.success("Pagamento aprovado! Campanha ativada.");

      // ✅ agora sim: limpa wizard e volta pro dashboard
      resetData();
      try {
        localStorage.removeItem(STEP_STORAGE_KEY);
      } catch {
        // ignore
      }

      navigate("/dashboard-contratante", { replace: true });
    } catch (e: any) {
      console.error("SIMULATE_PAYMENT_EXCEPTION", e);
      toast.error(e?.message || "Erro ao simular pagamento.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <MobileLayout
      title="Pagamento"
      showBack
      backTo="/criar-campanha"
      showNav={false}
      showHome
      homeRoute="/dashboard-contratante"
    >
      <div className="px-6 py-4 space-y-4">
        <h3 className="font-display text-xl font-bold text-foreground">Pagamento (simulado)</h3>

        {loading ? (
          <div className="glass-card p-4 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando…
          </div>
        ) : !campaign ? (
          <div className="glass-card p-4 text-sm text-muted-foreground">Campanha não encontrada.</div>
        ) : (
          <>
            <div className="glass-card p-4 space-y-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Resumo</div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Campanha</span>
                <span className="text-foreground font-medium truncate ml-4">{campaign.title || "—"}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="text-foreground font-medium">{campaign.status || "—"}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="text-foreground font-semibold">{quoteTotal !== null ? formatBRL(quoteTotal) : "—"}</span>
              </div>

              <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                Segurança: ativação só ocorre via RPC no Supabase.
              </div>
            </div>

            <button
              type="button"
              onClick={simulatePayment}
              disabled={!canSimulate || paying}
              className={`w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                canSimulate && !paying ? "bg-gradient-neon text-primary-foreground glow-blue" : "bg-secondary text-muted-foreground"
              }`}
            >
              {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {paying ? "Processando..." : "Simular pagamento aprovado"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/criar-campanha")}
              className="w-full py-4 rounded-xl border border-border/50 text-muted-foreground font-medium text-sm flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>

            {!canSimulate ? (
              <div className="text-[11px] text-muted-foreground">
                Esta campanha não está em <span className="text-foreground font-medium">pending_payment</span>.
              </div>
            ) : null}
          </>
        )}
      </div>
    </MobileLayout>
  );
}