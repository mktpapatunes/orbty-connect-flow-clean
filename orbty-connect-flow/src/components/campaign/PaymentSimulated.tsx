// src/pages/campaign/PaymentSimulated.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import MobileLayout from "@/components/MobileLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCampaign } from "@/contexts/CampaignContext";

type CampaignRow = {
  id: string;
  title: string | null;
  status: string | null;
  requirements: any;
};

function formatBRL(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

export default function PaymentSimulated() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { resetData } = useCampaign();

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [campaign, setCampaign] = useState<CampaignRow | null>(null);

  const quoteTotal = useMemo(() => {
    const v = campaign?.requirements?.quote_total;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }, [campaign]);

  useEffect(() => {
    let alive = true;

    if (!id) {
      setLoading(false);
      setCampaign(null);
      return;
    }

    (async () => {
      try {
        setLoading(true);

        // RLS deve garantir que só o owner veja
        const { data, error } = await supabase
          .from("campaigns")
          .select("id,title,status,requirements")
          .eq("id", id)
          .maybeSingle();

        if (!alive) return;

        if (error) {
          console.error("PAYMENT_FETCH_CAMPAIGN_ERROR", error);
          toast.error("Não foi possível carregar a campanha.");
          setCampaign(null);
          return;
        }

        if (!data) {
          toast.error("Campanha não encontrada ou acesso negado.");
          setCampaign(null);
          return;
        }

        setCampaign(data as any);
      } catch (e) {
        console.error("PAYMENT_FETCH_CAMPAIGN_EXCEPTION", e);
        if (!alive) return;
        toast.error("Erro ao carregar a campanha.");
        setCampaign(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const canPay = !!campaign && campaign.status === "pending_payment" && quoteTotal !== null && quoteTotal > 0;

  const onPaySimulated = async () => {
    if (!id || !canPay) return;

    try {
      setPaying(true);

      const { data, error } = await (supabase.rpc as any)("simulate_campaign_payment", {
        p_campaign_id: id,
      });

      if (error) {
        console.error("SIMULATE_PAYMENT_RPC_ERROR", error);
        toast.error("Não foi possível simular o pagamento.");
        return;
      }

      const ok = !!data?.ok;
      const message = String(data?.message || "");

      if (!ok) {
        toast.error(message || "Pagamento não aprovado.");
        return;
      }

      toast.success(message || "Pagamento aprovado!");

      // ✅ agora que deu tudo certo, limpa wizard + step persistente
      resetData();
      try {
        localStorage.removeItem("orbty:create_campaign:step:v1");
      } catch {
        // ignore
      }

      navigate("/dashboard-contratante");
    } catch (e: any) {
      console.error("SIMULATE_PAYMENT_EXCEPTION", e);
      toast.error(e?.message || "Erro ao processar o pagamento.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <MobileLayout
      title="Pagamento"
      showBack
      backTo="/dashboard-contratante"
      showNav={false}
      showHome
      homeRoute="/dashboard-contratante"
    >
      <div className="px-6 py-4 space-y-4">
        {loading ? (
          <div className="glass-card p-4 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando…
          </div>
        ) : !campaign ? (
          <div className="glass-card p-4 text-sm text-muted-foreground">
            Não foi possível carregar a campanha.
            <div className="mt-3">
              <button
                type="button"
                onClick={() => navigate("/dashboard-contratante")}
                className="px-4 py-3 rounded-xl border border-border/50 text-muted-foreground font-semibold text-sm hover:bg-white/5 inline-flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="glass-card p-4 space-y-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Campanha</div>
              <div className="text-base font-semibold text-foreground">{campaign.title || "—"}</div>
              <div className="text-[12px] text-muted-foreground">
                Status: <span className="text-foreground font-medium">{campaign.status || "—"}</span>
              </div>
            </div>

            <div className="glass-card p-4 space-y-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total</div>
              <div className="text-2xl font-bold text-foreground">{formatBRL(quoteTotal)}</div>
              <div className="text-[11px] text-muted-foreground">Pagamento simulado (por enquanto).</div>
            </div>

            {campaign.status !== "pending_payment" ? (
              <div className="glass-card p-4 text-sm text-muted-foreground">
                Esta campanha não está pendente de pagamento.
              </div>
            ) : null}

            <button
              type="button"
              onClick={onPaySimulated}
              disabled={!canPay || paying}
              className={`w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                canPay && !paying ? "bg-gradient-neon text-primary-foreground glow-blue" : "bg-secondary text-muted-foreground"
              }`}
            >
              {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {paying ? "Processando..." : "Pagar agora (simulado)"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/dashboard-contratante")}
              className="w-full py-4 rounded-xl border border-border/50 text-muted-foreground font-medium text-sm"
            >
              Voltar
            </button>
          </>
        )}
      </div>
    </MobileLayout>
  );
}