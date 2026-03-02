import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CampaignType = "event" | "music" | "product" | "";

// deixa flexível, mas evita qualquer string bizarra no app
export type CampaignFormat = "stories" | "reels" | "feed" | "tiktok" | string;

export interface CampaignFormData {
  title: string;
  campaignType: CampaignType;

  selectedState: string;
  selectedCity: string;

  // localização completa (ex: "Moema, São Paulo, São Paulo")
  region: string;

  // Período
  campaignDate: string; // início (YYYY-MM-DD)
  applyDeadline: string; // fim (YYYY-MM-DD)

  // Objetivos (chips) - CSV
  briefPublic: string;

  // Briefing privado
  briefPrivate: string;

  // Etapa 2
  contentSegments: string; // CSV: "Humor, Educação"
  creatorsNeeded: number; // 1..50
  selectedCreatorIds: string[]; // seleção manual

  // Mantidos (requirements atual)
  posts: number;
  format: CampaignFormat;
  hashtags: string; // CSV
  mentions: string; // CSV
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

function clampInt(n: unknown, min: number, max: number, fallback: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function asString(v: unknown, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function sanitizeCsv(v: unknown) {
  // mantém como string; só evita null/objeto quebrando
  return asString(v, "");
}

function sanitizeCampaignType(v: unknown): CampaignType {
  const s = asString(v, "");
  if (s === "event" || s === "music" || s === "product" || s === "") return s;
  return "";
}

function sanitizeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string");
}

function safeParseDraft(raw: string | null): CampaignFormData | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;

    const out: CampaignFormData = {
      ...initialData,

      title: asString((obj as any).title, initialData.title),
      campaignType: sanitizeCampaignType((obj as any).campaignType),

      selectedState: asString((obj as any).selectedState, initialData.selectedState),
      selectedCity: asString((obj as any).selectedCity, initialData.selectedCity),
      region: asString((obj as any).region, initialData.region),

      campaignDate: asString((obj as any).campaignDate, initialData.campaignDate),
      applyDeadline: asString((obj as any).applyDeadline, initialData.applyDeadline),

      briefPublic: sanitizeCsv((obj as any).briefPublic),
      briefPrivate: asString((obj as any).briefPrivate, initialData.briefPrivate),

      contentSegments: sanitizeCsv((obj as any).contentSegments),
      creatorsNeeded: clampInt((obj as any).creatorsNeeded, 1, 50, initialData.creatorsNeeded),
      selectedCreatorIds: sanitizeStringArray((obj as any).selectedCreatorIds),

      posts: clampInt((obj as any).posts, 1, 50, initialData.posts),
      format: asString((obj as any).format, initialData.format),
      hashtags: sanitizeCsv((obj as any).hashtags),
      mentions: sanitizeCsv((obj as any).mentions),
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

  const updateData: CampaignContextType["updateData"] = (updates) => {
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

  // Persistência automática (com debounce leve)
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