// src/contexts/CampaignContext.tsx
import { createContext, useContext, useState, ReactNode } from "react";

export interface CampaignFormData {
  title: string;
  campaignType: string;
  selectedState: string;
  selectedCity: string;

  // ✅ Agora usamos region como "bairro, cidade, estado"
  region: string;

  // Período
  campaignDate: string; // início
  applyDeadline: string; // fim

  // Objetivos (chips) persistem aqui
  briefPublic: string;

  briefPrivate: string;

  // ✅ NOVOS (Etapa 2)
  contentSegments: string; // "Humor, Educação, Música"
  creatorsNeeded: number; // 1..50

  // Mantidos (por compatibilidade com requirements atual)
  posts: number;
  format: string;
  hashtags: string;
  mentions: string;
}

interface CampaignContextType {
  data: CampaignFormData;
  updateData: (updates: Partial<CampaignFormData>) => void;
  resetData: () => void;
}

const initialData: CampaignFormData = {
  title: "",
  campaignType: "",
  selectedState: "",
  selectedCity: "",
  region: "",
  campaignDate: "",
  applyDeadline: "",
  briefPublic: "",
  briefPrivate: "",

  // ✅ novos
  contentSegments: "",
  creatorsNeeded: 1,

  // mantidos
  posts: 1,
  format: "stories",
  hashtags: "",
  mentions: "",
};

const CampaignContext = createContext<CampaignContextType | null>(null);

export const useCampaign = () => {
  const ctx = useContext(CampaignContext);
  if (!ctx) throw new Error("useCampaign must be used within CampaignProvider");
  return ctx;
};

export const CampaignProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<CampaignFormData>(initialData);

  const updateData = (updates: Partial<CampaignFormData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const resetData = () => setData(initialData);

  return <CampaignContext.Provider value={{ data, updateData, resetData }}>{children}</CampaignContext.Provider>;
};