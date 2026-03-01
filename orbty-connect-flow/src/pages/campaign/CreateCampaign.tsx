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
} from "lucide-react";
import MobileLayout from "@/components/MobileLayout";
import CampaignProgress from "@/components/CampaignProgress";
import { useCampaign } from "@/contexts/CampaignContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

const CreateCampaign = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, updateData, resetData } = useCampaign();

  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* =========================================
     Datas
  ========================================= */

  const todayISO = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const formatDateBR = (value?: string | null) => {
    if (!value) return "-";

    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const d = isDateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);

    if (Number.isNaN(d.getTime())) return "-";

    return isDateOnly ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : d.toLocaleDateString("pt-BR");
  };

  const diffDaysInclusive = (startISO?: string, endISO?: string) => {
    if (!startISO || !endISO) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startISO) || !/^\d{4}-\d{2}-\d{2}$/.test(endISO)) return null;

    const s = new Date(`${startISO}T00:00:00Z`).getTime();
    const e = new Date(`${endISO}T00:00:00Z`).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return null;

    const days = Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
    return days > 0 ? days : null;
  };

  /* =========================================
     Objetivos (chips) - persistem em briefPublic
  ========================================= */

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

  const selectedObjectives = useMemo(() => parseObjectives(data.briefPublic || ""), [data.briefPublic]);

  const toggleObjective = (opt: ObjectiveOption) => {
    const current = selectedObjectives.slice();
    const exists = current.includes(opt);

    if (exists) {
      const next = current.filter((x) => x !== opt);
      updateData({ briefPublic: next.join(", ") });
      return;
    }

    if (current.length >= 3) {
      toast.error("Você pode selecionar no máximo 3 objetivos.");
      return;
    }

    const next = [...current, opt];
    updateData({ briefPublic: next.join(", ") });
  };

  /* =========================================
     Localização (busca + mapa)
  ========================================= */

  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<NominatimItem[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);

  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLon, setLocationLon] = useState<number | null>(null);

  // ✅ novo: label completo (bairro + cidade + estado)
  const [locationFullLabel, setLocationFullLabel] = useState<string>("");

  const autocompleteWrapRef = useRef<HTMLDivElement | null>(null);

  const locationLabelFallback = useMemo(() => {
    const c = (data.selectedCity || "").trim();
    const s = (data.selectedState || "").trim();
    if (c && s) return `${c}, ${s}`;
    if (c) return c;
    return "";
  }, [data.selectedCity, data.selectedState]);

  const displayLocationLabel = useMemo(() => {
    return (locationFullLabel || locationLabelFallback || "").trim();
  }, [locationFullLabel, locationLabelFallback]);

  // preencher input se vazio
  useEffect(() => {
    if (!locationQuery && displayLocationLabel) setLocationQuery(displayLocationLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayLocationLabel]);

  // click fora fecha dropdown
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      const el = autocompleteWrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setLocationOpen(false);
      }
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  // Debounce de busca
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

        const res = await fetch(url, {
          headers: { "Accept-Language": "pt-BR" },
        });

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

    // ✅ Queremos: "Moema, São Paulo, São Paulo"
    const parts = [neighborhood, city, state].map((x) => (x || "").trim()).filter(Boolean);
    if (parts.length >= 2) return parts.join(", ");
    // fallback
    return item.display_name;
  };

  const applyLocationFromNominatim = (item: NominatimItem) => {
    const addr = item.address || {};
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || "";
    const state = addr.state || addr.state_district || addr.region || "";

    updateData({
      selectedCity: city || data.selectedCity || "",
      selectedState: state || data.selectedState || "",
    });

    const full = buildFullLocationLabel(item);
    setLocationFullLabel(full);

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
    setLocationFullLabel("");
    updateData({ selectedCity: "", selectedState: "" });
  };

  // re-hidrata mapa e label (se tiver city/state)
  const [hydratingMap, setHydratingMap] = useState(false);
  useEffect(() => {
    let alive = true;

    const shouldHydrate =
      step === 1 &&
      !!data.selectedCity &&
      !!data.selectedState &&
      (locationLat === null || locationLon === null || !locationFullLabel) &&
      !hydratingMap;

    if (!shouldHydrate) return;

    (async () => {
      try {
        setHydratingMap(true);
        const q = locationQuery.trim() || `${data.selectedCity}, ${data.selectedState}, Brasil`;

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

          // tenta recompor label completo
          const full = buildFullLocationLabel(first);
          setLocationFullLabel(full);
          if (!locationQuery) setLocationQuery(full);
        }
      } catch {
        // ignora
      } finally {
        if (alive) setHydratingMap(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, data.selectedCity, data.selectedState]);

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

  /* =========================================
     Período de campanha (date range)
  ========================================= */

  const [periodOpen, setPeriodOpen] = useState(false);
  const [tmpStart, setTmpStart] = useState<string>("");
  const [tmpEnd, setTmpEnd] = useState<string>("");

  const openPeriodModal = () => {
    setTmpStart(data.campaignDate || "");
    setTmpEnd(data.applyDeadline || "");
    setPeriodOpen(true);
  };

  const closePeriodModal = () => setPeriodOpen(false);

  const periodDays = useMemo(() => diffDaysInclusive(data.campaignDate, data.applyDeadline), [data.campaignDate, data.applyDeadline]);

  const periodLabel = useMemo(() => {
    const s = data.campaignDate;
    const e = data.applyDeadline;
    if (!s || !e) return "";
    const days = diffDaysInclusive(s, e);
    const daysLabel = days ? ` • ${days} dia${days > 1 ? "s" : ""}` : "";
    return `${formatDateBR(s)} → ${formatDateBR(e)}${daysLabel}`;
  }, [data.campaignDate, data.applyDeadline]);

  const confirmPeriod = () => {
    const s = tmpStart;
    const e = tmpEnd;

    if (!s || !e) {
      toast.error("Selecione a data de início e a data final.");
      return;
    }
    if (s < todayISO) {
      toast.error("A data de início deve ser a partir de hoje.");
      return;
    }
    if (e < s) {
      toast.error("A data final deve ser igual ou após a data de início.");
      return;
    }

    updateData({ campaignDate: s, applyDeadline: e });
    setPeriodOpen(false);
  };

  /* =========================================
     Validations
  ========================================= */

  const canStep2 =
    data.title &&
    data.campaignType &&
    data.selectedState &&
    data.selectedCity &&
    data.campaignDate &&
    data.applyDeadline &&
    selectedObjectives.length > 0; // agora depende de objetivos

  const canStep3 = data.posts >= 1;
  const canPublish = canStep2 && canStep3;

  /* =========================================
     Files
  ========================================= */

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

  /* =========================================
     Publish
  ========================================= */

  const handlePublish = async () => {
    if (!user || !canPublish) return;
    setIsSubmitting(true);

    try {
      const region = `${data.selectedCity}, ${data.selectedState}`;
      const requirements = {
        posts: data.posts,
        format: data.format,
        hashtags: data.hashtags ? data.hashtags.split(",").map((h) => h.trim()) : [],
        mentions: data.mentions ? data.mentions.split(",").map((m) => m.trim()) : [],
      };

      const { data: campaignId, error: campaignError } = await supabase.rpc("create_campaign", {
        payload: {
          title: data.title,
          type: data.campaignType,
          region,
          state: data.selectedState,
          city: data.selectedCity,
          campaign_date: data.campaignDate || null,
          apply_deadline: data.applyDeadline,
          brief_public: data.briefPublic, // agora: "Novos clientes, Engajamento..."
          brief_private: data.briefPrivate || null,
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
      navigate("/dashboard-contratante");
    } catch (error: any) {
      console.error("CREATE_CAMPAIGN_ERROR", error);
      toast.error(error.message || "Erro ao criar campanha. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

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

      {/* Step 1 */}
      {step === 1 && (
        <div className="px-6 py-4 space-y-4">
          <h3 className="font-display text-xl font-bold text-foreground">Informações da campanha</h3>

          {/* Title */}
          <div>
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Título</label>
            <input
              type="text"
              value={data.title}
              onChange={(e) => updateData({ title: e.target.value })}
              placeholder="Ex: Festa de lançamento XYZ"
              className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {campaignTypes.map((type) => {
                const selected = data.campaignType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => updateData({ campaignType: selected ? "" : type.id })}
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
          </div>

          {/* Localização */}
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
                    Selecione uma sugestão para atualizar o mapa e salvar Estado/Cidade.
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="text-muted-foreground">
                Localização selecionada:
                <span className="ml-2 text-foreground font-medium">{displayLocationLabel || "—"}</span>
              </div>
              {displayLocationLabel ? (
                <button type="button" onClick={() => setLocationOpen((v) => !v)} className="text-primary hover:opacity-90 transition">
                  {locationOpen ? "Fechar" : "Editar"}
                </button>
              ) : null}
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

          {/* Período */}
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

          {/* Objetivos (chips) */}
          <div>
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">
              Objetivo da campanha * <span className="normal-case tracking-normal text-muted-foreground">(selecione até 3)</span>
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

          {/* Modal Período */}
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

                <div className="mt-4 grid grid-cols-2 gap-3">
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

      {/* Step 2 */}
      {step === 2 && (
        <div className="px-6 py-4 space-y-4">
          <h3 className="font-display text-xl font-bold text-foreground">Requisitos da campanha</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Nº de posts *</label>
              <input
                type="number"
                min={1}
                value={data.posts}
                onChange={(e) => updateData({ posts: parseInt(e.target.value) || 1 })}
                className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Formato</label>
              <select
                value={data.format}
                onChange={(e) => updateData({ format: e.target.value })}
                className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="stories">Stories</option>
                <option value="feed">Feed</option>
                <option value="reels">Reels</option>
                <option value="misto">Misto</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Hashtags (separadas por vírgula)</label>
            <input
              type="text"
              value={data.hashtags}
              onChange={(e) => updateData({ hashtags: e.target.value })}
              placeholder="#festa, #evento"
              className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Menções (separadas por vírgula)</label>
            <input
              type="text"
              value={data.mentions}
              onChange={(e) => updateData({ mentions: e.target.value })}
              placeholder="@marca, @evento"
              className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Briefing privado (só para aceitas)</label>
            <textarea
              value={data.briefPrivate}
              onChange={(e) => updateData({ briefPrivate: e.target.value })}
              placeholder="Instruções detalhadas visíveis somente após aprovação..."
              rows={4}
              className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="px-6 py-4 space-y-4">
          <h3 className="font-display text-xl font-bold text-foreground">Arquivos & Publicação</h3>

          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,.pdf" onChange={handleFileSelect} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-border/60 rounded-xl p-6 flex flex-col items-center gap-2 text-center hover:border-primary/30 transition-colors"
          >
            <Upload className="w-7 h-7 text-muted-foreground" />
            <p className="text-sm text-foreground/80 font-medium">Enviar arquivos</p>
            <p className="text-xs text-muted-foreground/60">Imagens, vídeos ou PDFs</p>
          </button>

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
                  <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="glass-card p-4 space-y-2">
            <h4 className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Resumo</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Título</span>
                <span className="text-foreground font-medium truncate ml-4">{data.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo</span>
                <span className="text-foreground font-medium capitalize">{data.campaignType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Local</span>
                <span className="text-foreground font-medium truncate ml-4">{displayLocationLabel || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Período</span>
                <span className="text-foreground font-medium">{periodLabel ? periodLabel : "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Objetivos</span>
                <span className="text-foreground font-medium truncate ml-4">
                  {selectedObjectives.length ? selectedObjectives.join(", ") : "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Posts</span>
                <span className="text-foreground font-medium">
                  {data.posts}x {data.format}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Arquivos</span>
                <span className="text-foreground font-medium">{files.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom navigation */}
      <div className="sticky bottom-0 px-6 py-4 bg-background/80 backdrop-blur-xl border-t border-border/30 flex gap-3">
        {step > 1 && (
          <button onClick={() => setStep(step - 1)} className="flex-1 py-4 rounded-xl border border-border/50 text-muted-foreground font-medium text-sm">
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
          >
            Avançar
          </button>
        ) : (
          <button
            onClick={handlePublish}
            disabled={!canPublish || isSubmitting}
            className={`flex-[2] py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              canPublish && !isSubmitting ? "bg-gradient-neon text-primary-foreground glow-blue" : "bg-secondary text-muted-foreground"
            }`}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isSubmitting ? "Publicando..." : "Publicar campanha"}
          </button>
        )}
      </div>
    </MobileLayout>
  );
};

export default CreateCampaign;