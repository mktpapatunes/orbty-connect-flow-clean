// src/components/CampaignProgress.tsx

interface CampaignProgressProps {
  currentStep: number;
  totalSteps?: number;
}

const stepLabels: Record<number, string> = {
  1: "Informações",
  2: "Requisitos",
  3: "Arquivos & Publicar",
  4: "Resumo",
  5: "Pagamento",
};

const clampInt = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const CampaignProgress = ({ currentStep, totalSteps = 5 }: CampaignProgressProps) => {
  const safeTotal = Number.isFinite(totalSteps) ? clampInt(Math.floor(totalSteps), 1, 20) : 5;
  const safeCurrent = Number.isFinite(currentStep) ? clampInt(Math.floor(currentStep), 1, safeTotal) : 1;

  return (
    <div className="px-6 pt-4 pb-2">
      <div className="flex items-center gap-1">
        {Array.from({ length: safeTotal }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-500 ${
              i < safeCurrent ? "bg-gradient-neon" : "bg-border"
            }`}
          />
        ))}
      </div>

      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-muted-foreground">
          Etapa {safeCurrent} de {safeTotal}
        </p>

        <p className="text-xs text-primary font-medium">{stepLabels[safeCurrent] || ""}</p>
      </div>
    </div>
  );
};

export default CampaignProgress;