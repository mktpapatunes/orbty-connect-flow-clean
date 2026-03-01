import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export interface CampaignFormData {
  title: string;
  campaignType: string;
  selectedState: string;
  selectedCity: string;

  // localização completa (ex: "Moema, São Paulo, São Paulo")
  region: string;

  // Período
  campaignDate: string; // início
  applyDeadline: string; // fim

  // Objetivos (chips)
  briefPublic: string;

  // Briefing privado
  briefPrivate: string;

  // Etapa 2
  contentSegments: string; // "Humor, Educação"
  creatorsNeeded: number; // 1..50
  selectedCreatorIds: string[]; // ✅ seleção manual

  // Mantidos (requirements atual)
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

const STORAGE_KEY = "orbty:create_campaign:draft:v1";

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
  contentSegments: "",
  creatorsNeeded: 1,
  selectedCreatorIds: [],
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

function safeParseDraft(raw: string | null): CampaignFormData | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;

    // validação mínima de shape (evita crash)
    const out: CampaignFormData = {
      ...initialData,
      ...obj,
      creatorsNeeded: Number.isFinite(Number(obj.creatorsNeeded))
        ? Math.max(1, Math.min(50, Math.floor(Number(obj.creatorsNeeded))))
        : initialData.creatorsNeeded,
      selectedCreatorIds: Array.isArray(obj.selectedCreatorIds)
        ? obj.selectedCreatorIds.filter((x: any) => typeof x === "string")
        : [],
    };

    return out;
  } catch {
    return null;
  }
}

export const CampaignProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<CampaignFormData>(() => {
    const draft = safeParseDraft(localStorage.getItem(STORAGE_KEY));
    return draft ?? initialData;
  });

  const updateData = (updates: Partial<CampaignFormData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const resetData = () => {
    setData(initialData);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  // ✅ Persistência automática (com debounce leve)
  const serialized = useMemo(() => JSON.stringify(data), [data]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, serialized);
      } catch {
        // ignore
      }
    }, 200);

    return () => clearTimeout(t);
  }, [serialized]);

  return <CampaignContext.Provider value={{ data, updateData, resetData }}>{children}</CampaignContext.Provider>;
};