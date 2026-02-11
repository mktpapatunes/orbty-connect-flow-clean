interface CampaignProgressProps {
  currentStep: number;
  totalSteps?: number;
}

const stepLabels: Record<number, string> = {
  1: "Informações",
  2: "Requisitos",
  3: "Arquivos & Publicar",
};

const CampaignProgress = ({ currentStep, totalSteps = 3 }: CampaignProgressProps) => {
  return (
    <div className="px-6 pt-4 pb-2">
      <div className="flex items-center gap-1">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-500 ${
              i < currentStep ? "bg-gradient-neon" : "bg-border"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-muted-foreground">
          Etapa {currentStep} de {totalSteps}
        </p>
        <p className="text-xs text-primary font-medium">
          {stepLabels[currentStep] || ""}
        </p>
      </div>
    </div>
  );
};

export default CampaignProgress;
