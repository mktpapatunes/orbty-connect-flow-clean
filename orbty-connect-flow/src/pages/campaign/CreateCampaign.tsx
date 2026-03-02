// src/pages/campaign/CreateCampaign.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Music,
  ShoppingBag,
  MapPin,
  Upload,
  FileText,
  Trash2,
  Loader2,
  CheckCircle2,
  X,
  Search,
  Users,
  Layers,
} from "lucide-react";
import MobileLayout from "@/components/MobileLayout";
import CampaignProgress from "@/components/CampaignProgress";
import { useCampaign } from "@/contexts/CampaignContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* =========================
   Consts
========================= */

const PUBLIC_PROFILE_ROUTE_PREFIX = "/u";

function buildPublicProfileSrc(creatorId: string) {
  const isHashRouter = window.location.hash.startsWith("#/");
  // HashRouter precisa de /#/u/:id
  return isHashRouter ? `/#${PUBLIC_PROFILE_ROUTE_PREFIX}/${creatorId}` : `${PUBLIC_PROFILE_ROUTE_PREFIX}/${creatorId}`;
}
const STEP_STORAGE_KEY = "orbty:create_campaign:step:v1";

const campaignTypes = [
  { id: "event", label: "Evento", icon: Calendar },
  { id: "music", label: "Música", icon: Music },
  { id: "product", label: "Produto/Serviço", icon: ShoppingBag },
];

const objectiveOptions = [
  "Novos clientes",
  "Novos seguidores",
  "Novos ouvintes",
  "Venda/Cliques",
  "Engajamento",
  "Visualizações",
] as const;

type ObjectiveOption = (typeof objectiveOptions)[number];

// ✅ trocou "Família" por "Esportes"
const segmentOptions = [
  "Humor",
  "Educação",
  "Música",
  "Beleza",
  "Moda",
  "Gastronomia",
  "Fitness",
  "Lifestyle",
  "Viagem",
  "Tecnologia",
  "Games",
  "Negócios",
  "Arte",
  "Esportes",
  "Pets",
] as const;

type SegmentOption = (typeof segmentOptions)[number];

/* =========================
   Types
========================= */

interface UploadedFile {
  file: File;
  preview?: string;
}

type NominatimItem = {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    state_district?: string;
    region?: string;
    suburb?: string;
    neighbourhood?: string;
    country?: string;
  };
};

type CreatorListItem = {
  id: string;
  name: string | null;
  city: string | null;
  state: string | null;
  neighborhood?: string | null;
  followers: string | null;
  content_style: string | null;
  approval_status?: string | null;
  desired_role?: string | null;

  // ✅ opcional: se sua RPC retornar foto, já usamos direto
  avatar_url?: string | null;
  photo_url?: string | null;
  profile_photo_url?: string | null;
};

/* =========================
   Helpers
========================= */

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function followersToNumber(raw: any) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Formatação estilo Instagram */
function formatIGCount(input: number | null | undefined) {
  const n = Number(input ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "—";

  if (n < 10_000) return Math.floor(n).toLocaleString("pt-BR");

  if (n < 1_000_000) {
    const k = n / 1000;
    if (n < 100_000) {
      const val = Math.floor(k * 10) / 10;
      const str = val % 1 === 0 ? String(Math.floor(val)) : String(val);
      return `${str} mil`;
    }
    return `${Math.floor(k).toLocaleString("pt-BR")} mil`;
  }

  const m = n / 1_000_000;
  if (n < 10_000_000) {
    const val = Math.floor(m * 10) / 10;
    const str = val % 1 === 0 ? String(Math.floor(val)) : String(val);
    return `${str}M`;
  }
  return `${Math.floor(m)}M`;
}

function formatDateBR(value?: string | null) {
  if (!value) return "-";
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = isDateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return isDateOnly ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : d.toLocaleDateString("pt-BR");
}

function diffDaysInclusive(startISO?: string, endISO?: string) {
  if (!startISO || !endISO) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startISO) || !/^\d{4}-\d{2}-\d{2}$/.test(endISO)) return null;

  const s = new Date(`${startISO}T00:00:00Z`).getTime();
  const e = new Date(`${endISO}T00:00:00Z`).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return null;

  const days = Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
  return days > 0 ? days : null;
}

function initialsFromName(name?: string | null) {
  const n = String(name || "").trim();
  if (!n) return "C";
  const parts = n.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "C";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (first + last).toUpperCase();
}

/* =========================
   Page
========================= */

export default function CreateCampaign() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, updateData, resetData } = useCampaign();

  // ✅ step persistente
  const [step, setStep] = useState<number>(() => {
    const raw = localStorage.getItem(STEP_STORAGE_KEY);
    const n = Number(raw);
    return Number.isFinite(n) ? clamp(Math.floor(n), 1, 3) : 1;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STEP_STORAGE_KEY, String(step));
    } catch {
      // ignore
    }
  }, [step]);

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const todayISO = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  /* =========================
     Objetivos (chips) - usa briefPublic como storage
  ========================= */

  const parseObjectives = (raw: string): ObjectiveOption[] => {
    const parts = (raw || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const picked: ObjectiveOption[] = [];
    for (const p of parts) {
      const match = objectiveOptions.find((x) => x.toLowerCase() === p.toLowerCase());
      if (match && !picked.includes(match)) picked.push(match);
      if (picked.length >= 3) break;
    }
    return picked;
  };

  const selectedObjectives = useMemo(() => parseObjectives((data as any).briefPublic || ""), [(data as any).briefPublic]);

  const toggleObjective = (opt: ObjectiveOption) => {
    const current = selectedObjectives.slice();
    const exists = current.includes(opt);

    if (exists) {
      updateData({ briefPublic: current.filter((x) => x !== opt).join(", ") } as any);
      return;
    }
    if (current.length >= 3) {
      toast.error("Você pode selecionar no máximo 3 objetivos.");
      return;
    }
    updateData({ briefPublic: [...current, opt].join(", ") } as any);
  };

  /* =========================
     Segmentos (chips) - usa data.contentSegments
  ========================= */

  const parseSegments = (raw: string): SegmentOption[] => {
    const parts = (raw || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const picked: SegmentOption[] = [];
    for (const p of parts) {
      const match = segmentOptions.find((x) => x.toLowerCase() === p.toLowerCase());
      if (match && !picked.includes(match)) picked.push(match);
      if (picked.length >= 3) break;
    }
    return picked;
  };

  const selectedSegments = useMemo(() => parseSegments((data as any).contentSegments || ""), [(data as any).contentSegments]);

  const toggleSegment = (seg: SegmentOption) => {
    const current = selectedSegments.slice();
    const exists = current.includes(seg);

    if (exists) {
      updateData({ contentSegments: current.filter((x) => x !== seg).join(", ") } as any);
      return;
    }
    if (current.length >= 3) {
      toast.error("Você pode selecionar no máximo 3 segmentos.");
      return;
    }
    updateData({ contentSegments: [...current, seg].join(", ") } as any);
  };

  /* =========================
     Quantidade creators (sem spinner + permite apagar)
  ========================= */

  const creatorsNeededFromData = Number((data as any).creatorsNeeded ?? 1) || 1;

  const [creatorsNeededInput, setCreatorsNeededInput] = useState<string>(String(creatorsNeededFromData));

  useEffect(() => {
    setCreatorsNeededInput(String(Number((data as any).creatorsNeeded ?? 1) || 1));
  }, [(data as any).creatorsNeeded]);

  const creatorsNeededNumber = useMemo(() => {
    const raw = creatorsNeededInput.trim();
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return clamp(Math.floor(n), 1, 50);
  }, [creatorsNeededInput]);

  const creatorsNeededOk = creatorsNeededNumber !== null && creatorsNeededNumber >= 1 && creatorsNeededNumber <= 50;

  const currentLimit = creatorsNeededNumber ?? creatorsNeededFromData;

  /* =========================
     Localização (Nominatim + mapa)
  ========================= */

  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<NominatimItem[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);

  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLon, setLocationLon] = useState<number | null>(null);

  const autocompleteWrapRef = useRef<HTMLDivElement | null>(null);

  const displayLocationLabel = useMemo(() => {
    const reg = String((data as any).region || "").trim();
    if (reg) return reg;

    const c = String((data as any).selectedCity || "").trim();
    const s = String((data as any).selectedState || "").trim();
    if (c && s) return `${c}, ${s}`;
    return c || "";
  }, [(data as any).region, (data as any).selectedCity, (data as any).selectedState]);

  useEffect(() => {
    if (!locationQuery && displayLocationLabel) setLocationQuery(displayLocationLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayLocationLabel]);

  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      const el = autocompleteWrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setLocationOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const q = locationQuery.trim();

    if (!locationOpen) return;

    if (q.length < 3) {
      setLocationResults([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        if (!alive) return;
        setLocationLoading(true);

        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=br&q=${encodeURIComponent(
          q
        )}`;

        const res = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
        const json = (await res.json()) as NominatimItem[];
        if (!alive) return;

        setLocationResults(Array.isArray(json) ? json : []);
      } catch {
        if (!alive) return;
        setLocationResults([]);
      } finally {
        if (alive) setLocationLoading(false);
      }
    }, 350);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [locationQuery, locationOpen]);

  const buildFullLocationLabel = (item: NominatimItem) => {
    const addr = item.address || {};
    const neighborhood = addr.neighbourhood || addr.suburb || "";
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || "";
    const state = addr.state || addr.state_district || addr.region || "";
    const parts = [neighborhood, city, state].map((x) => (x || "").trim()).filter(Boolean);
    if (parts.length >= 2) return parts.join(", ");
    return item.display_name;
  };

  const applyLocationFromNominatim = (item: NominatimItem) => {
    const addr = item.address || {};
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || "";
    const state = addr.state || addr.state_district || addr.region || "";
    const full = buildFullLocationLabel(item);

    updateData({
      selectedCity: city || "",
      selectedState: state || "",
      region: full,
    } as any);

    setLocationQuery(full);
    setLocationOpen(false);
    setLocationResults([]);

    const lat = Number(item.lat);
    const lon = Number(item.lon);
    setLocationLat(Number.isFinite(lat) ? lat : null);
    setLocationLon(Number.isFinite(lon) ? lon : null);
  };

  const clearLocation = () => {
    setLocationQuery("");
    setLocationResults([]);
    setLocationLat(null);
    setLocationLon(null);
    setLocationOpen(false);
    updateData({ selectedCity: "", selectedState: "", region: "" } as any);
  };

  // hidrata lat/lon quando já tem cidade/estado (volta do app etc)
  const [hydratingMap, setHydratingMap] = useState(false);
  useEffect(() => {
    let alive = true;

    const city = String((data as any).selectedCity || "").trim();
    const state = String((data as any).selectedState || "").trim();

    const shouldHydrate =
      step === 1 &&
      !!city &&
      !!state &&
      (locationLat === null || locationLon === null) &&
      !hydratingMap;

    if (!shouldHydrate) return;

    (async () => {
      try {
        setHydratingMap(true);
        const q = String((data as any).region || "").trim() || `${city}, ${state}, Brasil`;

        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=br&q=${encodeURIComponent(
          q
        )}`;

        const res = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
        const json = (await res.json()) as NominatimItem[];
        if (!alive) return;

        const first = Array.isArray(json) ? json[0] : null;
        if (first?.lat && first?.lon) {
          const lat = Number(first.lat);
          const lon = Number(first.lon);
          setLocationLat(Number.isFinite(lat) ? lat : null);
          setLocationLon(Number.isFinite(lon) ? lon : null);

          // ✅ garante region completo (bairro/cidade/estado)
          if (!String((data as any).region || "").trim()) {
            updateData({ region: buildFullLocationLabel(first) } as any);
          }
        }
      } catch {
        // ignore
      } finally {
        if (alive) setHydratingMap(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, (data as any).selectedCity, (data as any).selectedState]);

  const mapSrc = useMemo(() => {
    if (locationLat !== null && locationLon !== null) {
      const lat = locationLat;
      const lon = locationLon;
      const delta = 0.035;
      const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
      return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
    }
    return `https://www.openstreetmap.org/export/embed.html?bbox=-74.0,-34.0,-34.0,5.0&layer=mapnik`;
  }, [locationLat, locationLon]);

  /* =========================
     Período (modal)
  ========================= */

  const [periodOpen, setPeriodOpen] = useState(false);
  const [tmpStart, setTmpStart] = useState<string>("");
  const [tmpEnd, setTmpEnd] = useState<string>("");

  const openPeriodModal = () => {
    setTmpStart(String((data as any).campaignDate || ""));
    setTmpEnd(String((data as any).applyDeadline || ""));
    setPeriodOpen(true);
  };

  const closePeriodModal = () => setPeriodOpen(false);

  const campaignStart = String((data as any).campaignDate || "");
  const campaignEnd = String((data as any).applyDeadline || "");

  const periodDays = useMemo(() => diffDaysInclusive(campaignStart, campaignEnd), [campaignStart, campaignEnd]);

  const periodLabel = useMemo(() => {
    if (!campaignStart || !campaignEnd) return "";
    const days = diffDaysInclusive(campaignStart, campaignEnd);
    const daysLabel = days ? ` • ${days} dia${days > 1 ? "s" : ""}` : "";
    return `${formatDateBR(campaignStart)} → ${formatDateBR(campaignEnd)}${daysLabel}`;
  }, [campaignStart, campaignEnd]);

  const confirmPeriod = () => {
    const s = tmpStart;
    const e = tmpEnd;

    if (!s || !e) return toast.error("Selecione a data de início e a data final.");
    if (s < todayISO) return toast.error("A data de início deve ser a partir de hoje.");
    if (e < s) return toast.error("A data final deve ser igual ou após a data de início.");

    updateData({ campaignDate: s, applyDeadline: e } as any);
    setPeriodOpen(false);
  };

  /* =========================
     Step 2: sugestões de creators (RPC)
  ========================= */

  const [creatorLoading, setCreatorLoading] = useState(false);
  const [creatorList, setCreatorList] = useState<CreatorListItem[]>([]);

  const selectedCity = String((data as any).selectedCity || "").trim();
  const selectedState = String((data as any).selectedState || "").trim();

  // ✅ carrega via RPC quando entrar no step 2 e tiver filtros
  useEffect(() => {
    let alive = true;

    const hasFilters = !!selectedCity && !!selectedState && selectedSegments.length > 0;

    if (step !== 2) return;

    if (!hasFilters) {
      setCreatorList([]);
      return;
    }

    (async () => {
      try {
        setCreatorLoading(true);

        // ⚠️ Ajuste os nomes dos parâmetros se a sua RPC estiver diferente.
        // get_creator_suggestions(p_city text, p_state text, p_segments text[], p_limit int)
        const { data: rpcData, error } = await (supabase.rpc as any)("get_creator_suggestions", {
          p_city: selectedCity,
          p_state: selectedState,
          p_segments: selectedSegments,
          p_limit: 30,
        });

        if (!alive) return;

        if (error) {
          console.error("GET_CREATOR_SUGGESTIONS_ERROR", error);
          setCreatorList([]);
          return;
        }

        const rows = (Array.isArray(rpcData) ? rpcData : []) as CreatorListItem[];

        // ✅ garante ordenação por followers (caso a RPC não ordene)
        const sorted = [...rows].sort(
          (a, b) => (followersToNumber(b.followers) ?? 0) - (followersToNumber(a.followers) ?? 0)
        );

        setCreatorList(sorted.slice(0, 30));
      } catch (e) {
        console.error("GET_CREATOR_SUGGESTIONS_EXCEPTION", e);
        if (alive) setCreatorList([]);
      } finally {
        if (alive) setCreatorLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [step, selectedCity, selectedState, selectedSegments]);

  const selectedCreatorIds: string[] = ((data as any).selectedCreatorIds || []) as string[];

  // ✅ selectedCreators precisa funcionar mesmo que creatorList não contenha o ID (ex: filtros mudaram)
  const selectedCreators = useMemo(() => {
    const map = new Map(creatorList.map((c) => [c.id, c]));
    return selectedCreatorIds
      .map((id) => map.get(id))
      .filter(Boolean) as CreatorListItem[];
  }, [creatorList, selectedCreatorIds]);

  /* =========================
     Perfil: modal (abre sem nova aba)
  ========================= */

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileCreatorId, setProfileCreatorId] = useState<string | null>(null);

  const openProfileModal = (id: string) => {
    setProfileCreatorId(id);
    setProfileOpen(true);
  };

  const closeProfileModal = () => {
    setProfileOpen(false);
    setProfileCreatorId(null);
  };

  useEffect(() => {
    if (!profileOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeProfileModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileOpen]);

  const toggleSelectCreator = (id: string) => {
    const current = selectedCreatorIds.slice();
    const exists = current.includes(id);

    // persiste creatorsNeeded válido antes de selecionar
    if (creatorsNeededNumber !== null && creatorsNeededNumber !== creatorsNeededFromData) {
      updateData({ creatorsNeeded: creatorsNeededNumber } as any);
    }

    const limit = creatorsNeededNumber ?? creatorsNeededFromData;

    if (exists) {
      updateData({ selectedCreatorIds: current.filter((x) => x !== id) } as any);
      return;
    }

    if (current.length >= limit) {
      toast.error(`Você já selecionou ${limit} creator${limit > 1 ? "s" : ""}. Aumente a quantidade para selecionar mais.`);
      return;
    }

    updateData({ selectedCreatorIds: [...current, id] } as any);
  };

  const removeSelectedCreator = (id: string) => {
    updateData({ selectedCreatorIds: selectedCreatorIds.filter((x) => x !== id) } as any);
  };

  const getCreatorAvatarUrl = (c: CreatorListItem) => {
    const anyC = c as any;
    const url =
      (c.avatar_url ?? null) ||
      (c.photo_url ?? null) ||
      (c.profile_photo_url ?? null) ||
      (anyC.avatarUrl ?? null) ||
      (anyC.photoUrl ?? null) ||
      (anyC.profilePhotoUrl ?? null) ||
      null;

    return typeof url === "string" && url.trim() ? url.trim() : null;
  };

  /* =========================
     Validations
  ========================= */

  const canStep2 =
    !!String((data as any).title || "").trim() &&
    !!String((data as any).campaignType || "").trim() &&
    !!selectedState &&
    !!selectedCity &&
    !!campaignStart &&
    !!campaignEnd &&
    selectedObjectives.length > 0;

  const canStep3 =
    selectedSegments.length > 0 &&
    creatorsNeededOk &&
    selectedCreatorIds.length > 0 &&
    selectedCreatorIds.length <= currentLimit;

  const canPublish = canStep2 && canStep3;

  /* =========================
     Files
  ========================= */

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;
    const newFiles: UploadedFile[] = Array.from(selected).map((file) => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  /* =========================
     Publish
  ========================= */

  const handlePublish = async () => {
    if (!user || !canPublish) return;
    setIsSubmitting(true);

    try {
      const region = String((data as any).region || "").trim() || `${selectedCity}, ${selectedState}`;
      const creatorsNeededFinal = creatorsNeededNumber ?? creatorsNeededFromData;

      const requirements = {
        posts: Number((data as any).posts ?? 1),
        format: String((data as any).format || "stories"),
        hashtags: String((data as any).hashtags || "")
          ? String((data as any).hashtags)
              .split(",")
              .map((h) => h.trim())
              .filter(Boolean)
          : [],
        mentions: String((data as any).mentions || "")
          ? String((data as any).mentions)
              .split(",")
              .map((m) => m.trim())
              .filter(Boolean)
          : [],
        creators_needed: creatorsNeededFinal,
        content_segments: selectedSegments,
        selected_creator_ids: selectedCreatorIds,
      };

      const { data: campaignId, error: campaignError } = await supabase.rpc("create_campaign", {
        payload: {
          title: String((data as any).title || ""),
          type: String((data as any).campaignType || ""),
          region,
          state: selectedState,
          city: selectedCity,
          campaign_date: campaignStart || null,
          apply_deadline: campaignEnd,
          brief_public: String((data as any).briefPublic || ""), // objetivos em chips (csv)
          brief_private: String((data as any).briefPrivate || "") || null,
          requirements,
        },
      });

      if (campaignError) {
        console.error("CREATE_CAMPAIGN_ERROR", campaignError);
        throw campaignError;
      }

      for (const { file } of files) {
        const path = `${campaignId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from("campaign-assets").upload(path, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        await supabase.from("campaign_assets").insert({
          campaign_id: campaignId,
          path,
          label: file.name,
          mime: file.type,
          size: file.size,
        } as any);
      }

      toast.success("Campanha publicada com sucesso!");
      resetData();
      try {
        localStorage.removeItem(STEP_STORAGE_KEY);
      } catch {
        // ignore
      }
      navigate("/dashboard-contratante");
    } catch (error: any) {
      console.error("CREATE_CAMPAIGN_ERROR", error);
      toast.error(error.message || "Erro ao criar campanha. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* =========================
     UI
  ========================= */

  return (
    <MobileLayout
      title="Nova campanha"
      showBack
      backTo="/dashboard-contratante"
      showNav={false}
      showHome
      homeRoute="/dashboard-contratante"
    >
      <CampaignProgress currentStep={step} />

      {/* =========================
          STEP 1
      ========================= */}
      {step === 1 && (
        <div className="px-6 py-4 space-y-4">
          <h3 className="font-display text-xl font-bold text-foreground">Informações da campanha</h3>

          {/* Title */}
          <div>
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Título</label>
            <input
              type="text"
              value={String((data as any).title || "")}
              onChange={(e) => updateData({ title: e.target.value } as any)}
              placeholder="Ex: Festa de lançamento XYZ"
              className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {campaignTypes.map((type) => {
                const selected = String((data as any).campaignType || "") === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => updateData({ campaignType: selected ? "" : type.id } as any)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      selected ? "border-primary/60 bg-primary/5 text-primary" : "border-border/50 bg-card/60 text-foreground/70"
                    }`}
                  >
                    <type.icon className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-xs font-medium">{type.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Dica: clique novamente no tipo selecionado para remover.</p>
          </div>

          {/* Objectives */}
          <div>
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">
              Objetivo da campanha * <span className="normal-case tracking-normal text-muted-foreground">(até 3)</span>
            </label>

            <div className="grid grid-cols-2 gap-2">
              {objectiveOptions.map((opt) => {
                const selected = selectedObjectives.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleObjective(opt)}
                    className={`px-3 py-3 rounded-xl border text-sm font-medium transition-all text-center ${
                      selected ? "border-primary/60 bg-primary/5 text-primary" : "border-border/50 bg-card/60 text-foreground/70"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 text-[11px] text-muted-foreground">
              Selecionados:{" "}
              <span className="text-foreground font-medium">{selectedObjectives.length ? selectedObjectives.join(", ") : "—"}</span>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2" ref={autocompleteWrapRef}>
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1 block">Localização</label>

            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={locationQuery}
                onChange={(e) => {
                  setLocationQuery(e.target.value);
                  setLocationOpen(true);
                }}
                onFocus={() => setLocationOpen(true)}
                placeholder="Digite cidade, bairro ou endereço (ex: Moema, São Paulo)"
                className="w-full bg-input border border-border/50 rounded-xl pl-9 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {(locationQuery || displayLocationLabel) && (
                <button
                  type="button"
                  onClick={clearLocation}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/5 text-muted-foreground"
                  aria-label="Limpar localização"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {locationOpen && (locationLoading || locationResults.length > 0) && (
                <div className="absolute z-20 mt-2 w-full rounded-xl border border-border/50 bg-background/95 backdrop-blur-xl shadow-lg overflow-hidden">
                  {locationLoading ? (
                    <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Buscando sugestões...
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-auto">
                      {locationResults.map((r) => {
                        const line = buildFullLocationLabel(r);
                        return (
                          <button
                            key={String(r.place_id)}
                            type="button"
                            onClick={() => applyLocationFromNominatim(r)}
                            className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition flex items-start gap-2"
                          >
                            <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-foreground truncate">{line}</div>
                              <div className="text-[11px] text-muted-foreground truncate">{r.display_name}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="px-4 py-2 border-t border-border/30 text-[11px] text-muted-foreground">
                    Selecione uma sugestão para atualizar o mapa e salvar a localização completa.
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              Localização selecionada: <span className="text-foreground font-medium">{displayLocationLabel || "—"}</span>
            </div>

            <div className="rounded-2xl overflow-hidden border border-border/50 bg-card/60">
              <iframe title="Mapa" src={mapSrc} className="w-full h-44" loading="lazy" referrerPolicy="no-referrer" />
            </div>

            {hydratingMap ? (
              <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Atualizando mapa...
              </div>
            ) : null}
          </div>

          {/* Period */}
          <div>
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Período de campanha *</label>

            <button
              type="button"
              onClick={openPeriodModal}
              className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-left text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 hover:bg-white/5 transition flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <span className="truncate">{periodLabel ? periodLabel : "Selecionar período (início e fim)"}</span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">Alterar</span>
            </button>

            {periodDays ? (
              <div className="mt-2 text-[11px] text-muted-foreground">
                Total: <span className="text-foreground font-medium">{periodDays} dia{periodDays > 1 ? "s" : ""}</span>
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-muted-foreground">Escolha início e fim a partir de hoje.</div>
            )}
          </div>

          {/* Period Modal */}
          {periodOpen && (
            <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
              <div className="absolute inset-0 bg-black/60" onMouseDown={closePeriodModal} />
              <div
                className="relative w-full md:max-w-lg rounded-t-3xl md:rounded-3xl border border-border/50 bg-background p-5"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-foreground">Período de campanha</div>
                  <button className="p-2 rounded-xl hover:bg-white/5" onClick={closePeriodModal} type="button" aria-label="Fechar">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Início</label>
                    <input
                      type="date"
                      value={tmpStart}
                      min={todayISO}
                      onChange={(e) => {
                        const v = e.target.value;
                        setTmpStart(v);
                        if (tmpEnd && v && tmpEnd < v) setTmpEnd("");
                      }}
                      className="w-full bg-input border border-border/50 rounded-xl px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Fim</label>
                    <input
                      type="date"
                      value={tmpEnd}
                      min={tmpStart || todayISO}
                      onChange={(e) => setTmpEnd(e.target.value)}
                      className="w-full bg-input border border-border/50 rounded-xl px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                <div className="mt-3 text-xs text-muted-foreground">
                  {tmpStart && tmpEnd ? (
                    <>
                      Resultado:{" "}
                      <span className="text-foreground font-medium">
                        {formatDateBR(tmpStart)} → {formatDateBR(tmpEnd)}
                      </span>
                      {diffDaysInclusive(tmpStart, tmpEnd) ? (
                        <span className="text-muted-foreground"> • {diffDaysInclusive(tmpStart, tmpEnd)} dia(s)</span>
                      ) : null}
                    </>
                  ) : (
                    "Selecione as duas datas."
                  )}
                </div>

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={closePeriodModal}
                    className="flex-1 py-3 rounded-xl border border-border/50 text-muted-foreground font-medium text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmPeriod}
                    className="flex-[2] py-3 rounded-xl font-semibold text-sm bg-gradient-neon text-primary-foreground glow-blue"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================
          STEP 2
      ========================= */}
{step === 2 && (
  <div className="px-6 py-4 space-y-4">
    <h3 className="font-display text-xl font-bold text-foreground">
      Requisitos da campanha
    </h3>

    {/* Segments */}
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Layers className="w-4 h-4 text-primary" />
        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
          Segmento do conteúdo *{" "}
          <span className="normal-case tracking-normal text-muted-foreground">
            (até 3)
          </span>
        </label>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {segmentOptions.map((seg) => {
          const selected = selectedSegments.includes(seg);
          return (
            <button
              key={seg}
              type="button"
              onClick={() => toggleSegment(seg)}
              className={`px-2 sm:px-3 py-2.5 sm:py-3 rounded-xl border font-medium transition-all text-center leading-tight
              text-[12px] sm:text-[12px] md:text-sm
              whitespace-normal break-words min-w-0
              ${
                selected
                  ? "border-primary/60 bg-primary/5 text-primary"
                  : "border-border/50 bg-card/60 text-foreground/70"
              }`}
            >
              <span className="block w-full min-w-0 overflow-hidden text-ellipsis">
                {seg}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 text-[11px] text-muted-foreground">
        Selecionados:{" "}
        <span className="text-foreground font-medium">
          {selectedSegments.length
            ? selectedSegments.join(", ")
            : "—"}
        </span>
      </div>
    </div>

    {/* Quantidade de creators */}
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-4 h-4 text-primary" />
        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
          Quantidade de creators *
        </label>
      </div>

      <div className="text-[12px] text-muted-foreground mb-3">
        Defina a quantidade de creators que você gostaria que divulgasse sua campanha.
      </div>

      <input
        inputMode="numeric"
        pattern="[0-9]*"
        value={creatorsNeededInput}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "" || /^\d+$/.test(v)) setCreatorsNeededInput(v);
        }}
        onBlur={() => {
          const safe = creatorsNeededNumber ?? 1;
          updateData({ creatorsNeeded: safe } as any);

          const cut = selectedCreatorIds.slice(0, safe);
          if (cut.length !== selectedCreatorIds.length)
            updateData({ selectedCreatorIds: cut } as any);

          setCreatorsNeededInput(String(safe));
        }}
        placeholder="Ex: 5"
        className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
      />

      <div className="mt-2 text-[11px] text-muted-foreground">
        Limite: até{" "}
        <span className="text-foreground font-medium">
          50 creators
        </span>.
      </div>
    </div>

    {/* Creators sugeridos */}
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
        Creators sugeridos
      </div>

      {!selectedCity || !selectedState || selectedSegments.length === 0 ? (
        <div className="glass-card p-4 text-sm text-muted-foreground">
          Defina <span className="text-foreground font-medium">Localização</span> e pelo menos{" "}
          <span className="text-foreground font-medium">1 segmento</span> para ver sugestões.
        </div>
      ) : creatorList.length === 0 && !creatorLoading ? (
        <div className="glass-card p-4 text-sm text-muted-foreground">
          Nenhum creator encontrado para os filtros atuais.
          <span className="text-foreground font-medium">
            {" "}Selecione outro segmento para ampliar a busca.
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {creatorList.map((c) => {
            const selected = selectedCreatorIds.includes(c.id);
            const followersLabel = formatIGCount(
              followersToNumber(c.followers)
            );
            const avatarUrl = getCreatorAvatarUrl(c);

            return (
              <div
                key={c.id}
                className={`glass-card p-3 flex items-center gap-3 transition ${
                  selected ? "border-primary/60 bg-primary/5" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => openProfileModal(c.id)}
                  className="flex-1 min-w-0 text-left flex items-center gap-3"
                >
                  <div className="w-11 h-11 rounded-full border border-border/50 bg-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={c.name || "Creator"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-muted-foreground">
                        {initialsFromName(c.name)}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {c.name || "Creator"}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {c.city && c.state
                        ? `${c.city}, ${c.state}`
                        : c.city || c.state || "—"}{" "}
                      • {followersLabel} seguidores
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelectCreator(c.id);
                  }}
                  className={`shrink-0 text-xs font-semibold px-3 py-2 rounded-xl border transition ${
                    selected
                      ? "border-primary/60 text-primary bg-primary/5"
                      : "border-border/50 text-muted-foreground hover:bg-white/5"
                  }`}
                >
                  {selected ? "Selecionado" : "Selecionar"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>

    {/* Creators selecionados */}
    <div className="glass-card p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
        Creators selecionados
      </div>

      {selectedCreatorIds.length === 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">
          Nenhum creator selecionado ainda.
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedCreators.map((c) => (
            <div
              key={c.id}
              className="inline-flex items-center gap-2 rounded-xl border border-border/50 bg-white/5 px-3 py-2 text-sm"
            >
              <span className="text-foreground font-medium truncate max-w-[170px]">
                {c.name || "Creator"}
              </span>
              <button
                type="button"
                onClick={() => removeSelectedCreator(c.id)}
                className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
)}

      {/* =========================
          STEP 3
      ========================= */}
      {step === 3 && (
        <div className="px-6 py-4 space-y-4">
          <h3 className="font-display text-xl font-bold text-foreground">Arquivos & Publicação</h3>

          {/* Upload */}
          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,.pdf" onChange={handleFileSelect} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-border/60 rounded-xl p-6 flex flex-col items-center gap-2 text-center hover:border-primary/30 transition-colors"
            type="button"
          >
            <Upload className="w-7 h-7 text-muted-foreground" />
            <p className="text-sm text-foreground/80 font-medium">Enviar arquivos</p>
            <p className="text-xs text-muted-foreground/60">Imagens, vídeos ou PDFs</p>
          </button>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="glass-card p-3 flex items-center gap-3">
                  {f.preview ? (
                    <img src={f.preview} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground truncate">{f.file.name}</p>
                    <p className="text-[10px] text-muted-foreground">{(f.file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive transition-colors" type="button">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          <div className="glass-card p-4 space-y-2">
            <h4 className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Resumo</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Título</span>
                <span className="text-foreground font-medium truncate ml-4">{String((data as any).title || "")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo</span>
                <span className="text-foreground font-medium capitalize">{String((data as any).campaignType || "")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Região</span>
                <span className="text-foreground font-medium truncate ml-4">
                  {String((data as any).region || "") || `${selectedCity}, ${selectedState}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Período</span>
                <span className="text-foreground font-medium truncate ml-4">{periodLabel || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Objetivos</span>
                <span className="text-foreground font-medium truncate ml-4">{selectedObjectives.length ? selectedObjectives.join(", ") : "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Segmentos</span>
                <span className="text-foreground font-medium truncate ml-4">{selectedSegments.length ? selectedSegments.join(", ") : "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Creators</span>
                <span className="text-foreground font-medium">
                  {selectedCreatorIds.length}/{currentLimit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Arquivos</span>
                <span className="text-foreground font-medium">{files.length}</span>
              </div>
            </div>
          </div>

          {/* Publish */}
          <button
            onClick={handlePublish}
            disabled={!canPublish || isSubmitting}
            className={`w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              canPublish && !isSubmitting ? "bg-gradient-neon text-primary-foreground glow-blue" : "bg-secondary text-muted-foreground"
            }`}
            type="button"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isSubmitting ? "Publicando..." : "Publicar campanha"}
          </button>
        </div>
      )}

      {/* ✅ Modal de perfil (sem navegar / sem nova aba) */}
      {profileOpen && profileCreatorId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <div className="absolute inset-0 bg-black/60" onMouseDown={closeProfileModal} />
          <div
            className="relative w-full md:max-w-3xl h-[85vh] md:h-[80vh] rounded-t-3xl md:rounded-3xl border border-border/50 bg-background overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between bg-background/80 backdrop-blur-xl">
              <div className="text-sm font-semibold text-foreground">Perfil do creator</div>
              <button type="button" onClick={closeProfileModal} className="p-2 rounded-xl hover:bg-white/5" aria-label="Fechar">
                <X className="w-4 h-4" />
              </button>
            </div>

            <iframe
  key={profileCreatorId}
  title="Perfil do creator"
  src={buildPublicProfileSrc(profileCreatorId)}
  className="w-full h-full"
/>
          </div>
        </div>
      )}

      {/* Bottom navigation */}
      <div className="sticky bottom-0 px-6 py-4 bg-background/80 backdrop-blur-xl border-t border-border/30 flex gap-3">
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            className="flex-1 py-4 rounded-xl border border-border/50 text-muted-foreground font-medium text-sm"
            type="button"
          >
            Voltar
          </button>
        )}

        {step < 3 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={step === 1 ? !canStep2 : !canStep3}
            className={`flex-[2] py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              (step === 1 ? canStep2 : canStep3) ? "bg-gradient-neon text-primary-foreground glow-blue" : "bg-secondary text-muted-foreground"
            }`}
            type="button"
          >
            Avançar
          </button>
        ) : null}
      </div>
    </MobileLayout>
  );
}