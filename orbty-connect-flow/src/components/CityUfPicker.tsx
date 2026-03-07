import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { MapPin, Loader2, ChevronDown, Check } from "lucide-react";

const UF_OPTIONS: Array<{ uf: string; name: string }> = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
];

function normalizeUF(v: string) {
  return (v || "").trim().toUpperCase().slice(0, 2);
}

function normalizeText(v: string) {
  return (v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function fetchCitiesByUF(
  uf: string,
  signal?: AbortSignal
): Promise<string[]> {
  const UF = normalizeUF(uf);
  if (!UF || UF.length !== 2) return [];

  const res = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${UF}/municipios`,
    { signal }
  );

  if (!res.ok) return [];

  const data = (await res.json()) as Array<{ nome: string }>;
  return (data || []).map((x) => x?.nome).filter(Boolean);
}

type Props = {
  uf: string;
  city: string;
  onChange: (next: { uf: string; city: string; cityValid: boolean }) => void;
  labels?: { uf?: string; city?: string };
  required?: boolean;
};

type DropdownPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function computeDropdownPosition(
  inputEl: HTMLElement,
  preferredHeight = 320
): DropdownPosition {
  const rect = inputEl.getBoundingClientRect();
  const viewportH = window.innerHeight;
  const margin = 8;
  const safeBottom = 16;

  const spaceBelow = viewportH - rect.bottom - safeBottom;
  const spaceAbove = rect.top - safeBottom;

  const openDown = spaceBelow >= 180 || spaceBelow >= spaceAbove;

  const maxHeight = Math.max(
    160,
    Math.min(preferredHeight, openDown ? spaceBelow - margin : spaceAbove - margin)
  );

  const top = openDown
    ? rect.bottom + margin
    : Math.max(safeBottom, rect.top - margin - maxHeight);

  return {
    top,
    left: rect.left,
    width: rect.width,
    maxHeight,
  };
}

export default function CityUfPicker({
  uf,
  city,
  onChange,
  labels,
  required,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [cities, setCities] = useState<string[]>([]);

  const [ufQuery, setUfQuery] = useState(uf || "");
  const [cityQuery, setCityQuery] = useState(city || "");

  const [openUf, setOpenUf] = useState(false);
  const [openCity, setOpenCity] = useState(false);

  const [activeUfIndex, setActiveUfIndex] = useState(-1);
  const [activeCityIndex, setActiveCityIndex] = useState(-1);

  const [ufPos, setUfPos] = useState<DropdownPosition | null>(null);
  const [cityPos, setCityPos] = useState<DropdownPosition | null>(null);

  const cacheRef = useRef<Record<string, string[]>>({});
  const abortRef = useRef<AbortController | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const ufInputRef = useRef<HTMLInputElement | null>(null);
  const cityInputRef = useRef<HTMLInputElement | null>(null);

  const ufListRef = useRef<HTMLDivElement | null>(null);
  const cityListRef = useRef<HTMLDivElement | null>(null);

  const UF = normalizeUF(uf);

  const selectedUfOption = useMemo(
    () => UF_OPTIONS.find((item) => item.uf === UF) ?? null,
    [UF]
  );

  const cityValid = useMemo(() => {
    const c = (city || "").trim();
    if (!UF || UF.length !== 2) return false;
    if (!c) return false;
    const list = cacheRef.current[UF] || cities;
    return list.includes(c);
  }, [UF, city, cities]);

  useEffect(() => {
    setUfQuery(uf || "");
  }, [uf]);

  useEffect(() => {
    setCityQuery(city || "");
  }, [city]);

  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      const wrap = wrapRef.current;
      if (wrap && !wrap.contains(target)) {
        setOpenUf(false);
        setOpenCity(false);
      }
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

    if (!UF || UF.length !== 2) {
      setCities([]);
      setOpenCity(false);
      setActiveCityIndex(-1);
      return;
    }

    (async () => {
      try {
        setLoading(true);

        if (cacheRef.current[UF]) {
          setCities(cacheRef.current[UF]);
          return;
        }

        if (abortRef.current) abortRef.current.abort();
        const ac = new AbortController();
        abortRef.current = ac;

        const list = await fetchCitiesByUF(UF, ac.signal);
        if (!alive) return;

        cacheRef.current[UF] = list;
        setCities(list);
      } catch {
        if (!alive) return;
        setCities([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [UF]);

  const filteredUFs = useMemo(() => {
    const q = normalizeText(ufQuery);
    if (!q) return UF_OPTIONS;

    return UF_OPTIONS.filter((item) => {
      const ufNorm = normalizeText(item.uf);
      const nameNorm = normalizeText(item.name);
      return ufNorm.includes(q) || nameNorm.includes(q);
    });
  }, [ufQuery]);

  const filteredCities = useMemo(() => {
    const q = normalizeText(cityQuery);
    const list = cities || [];

    if (!q) return list.slice(0, 50);

    return list.filter((x) => normalizeText(x).includes(q)).slice(0, 50);
  }, [cityQuery, cities]);

  const updateUfPosition = () => {
    if (!ufInputRef.current) return;
    setUfPos(computeDropdownPosition(ufInputRef.current, 320));
  };

  const updateCityPosition = () => {
    if (!cityInputRef.current) return;
    setCityPos(computeDropdownPosition(cityInputRef.current, 320));
  };

  useEffect(() => {
    if (!openUf) return;
    updateUfPosition();

    const handler = () => updateUfPosition();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);

    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [openUf, ufQuery]);

  useEffect(() => {
    if (!openCity) return;
    updateCityPosition();

    const handler = () => updateCityPosition();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);

    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [openCity, cityQuery, loading, UF]);

  useEffect(() => {
    setActiveUfIndex(filteredUFs.length > 0 ? 0 : -1);
  }, [ufQuery]);

  useEffect(() => {
    setActiveCityIndex(filteredCities.length > 0 ? 0 : -1);
  }, [cityQuery, UF]);

  useEffect(() => {
    if (!openUf || activeUfIndex < 0 || !ufListRef.current) return;
    const activeEl = ufListRef.current.querySelector<HTMLElement>(
      `[data-uf-index="${activeUfIndex}"]`
    );
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [openUf, activeUfIndex]);

  useEffect(() => {
    if (!openCity || activeCityIndex < 0 || !cityListRef.current) return;
    const activeEl = cityListRef.current.querySelector<HTMLElement>(
      `[data-city-index="${activeCityIndex}"]`
    );
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [openCity, activeCityIndex]);

  const pickUF = (value: string) => {
    const nextUF = normalizeUF(value);
    onChange({ uf: nextUF, city: "", cityValid: false });
    setUfQuery(nextUF);
    setCityQuery("");
    setOpenUf(false);
    setOpenCity(false);
  };

  const pickCity = (value: string) => {
    const v = (value || "").trim();
    onChange({ uf: UF, city: v, cityValid: true });
    setCityQuery(v);
    setOpenCity(false);
  };

  const onBlurUf = () => {
    const q = normalizeText(ufQuery);
    if (!q) {
      onChange({ uf: "", city: "", cityValid: false });
      setUfQuery("");
      setCityQuery("");
      return;
    }

    const exact =
      UF_OPTIONS.find((item) => normalizeText(item.uf) === q) ||
      UF_OPTIONS.find((item) => normalizeText(item.name) === q);

    if (exact) {
      pickUF(exact.uf);
      return;
    }

    const first = filteredUFs[0];
    if (first) {
      pickUF(first.uf);
      return;
    }

    onChange({ uf: "", city: "", cityValid: false });
    setUfQuery("");
    setCityQuery("");
  };

  const onBlurCity = () => {
    const q = (cityQuery || "").trim();

    if (!q) {
      onChange({ uf: UF, city: "", cityValid: false });
      return;
    }

    const list = cacheRef.current[UF] || cities;
    const exact = list.find((item) => item === q);

    if (exact) {
      onChange({ uf: UF, city: exact, cityValid: true });
      setCityQuery(exact);
      return;
    }

    onChange({ uf: UF, city: "", cityValid: false });
    setCityQuery("");
  };

  const handleUfKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!openUf && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpenUf(true);
      return;
    }

    if (!filteredUFs.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpenUf(true);
      setActiveUfIndex((prev) => (prev < filteredUFs.length - 1 ? prev + 1 : 0));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpenUf(true);
      setActiveUfIndex((prev) => (prev > 0 ? prev - 1 : filteredUFs.length - 1));
      return;
    }

    if (e.key === "Enter") {
      if (openUf && activeUfIndex >= 0 && filteredUFs[activeUfIndex]) {
        e.preventDefault();
        pickUF(filteredUFs[activeUfIndex].uf);
      }
      return;
    }

    if (e.key === "Escape") {
      setOpenUf(false);
    }
  };

  const handleCityKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!openCity && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpenCity(true);
      return;
    }

    if (!filteredCities.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpenCity(true);
      setActiveCityIndex((prev) =>
        prev < filteredCities.length - 1 ? prev + 1 : 0
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpenCity(true);
      setActiveCityIndex((prev) =>
        prev > 0 ? prev - 1 : filteredCities.length - 1
      );
      return;
    }

    if (e.key === "Enter") {
      if (openCity && activeCityIndex >= 0 && filteredCities[activeCityIndex]) {
        e.preventDefault();
        pickCity(filteredCities[activeCityIndex]);
      }
      return;
    }

    if (e.key === "Escape") {
      setOpenCity(false);
    }
  };

  return (
    <div className="space-y-3" ref={wrapRef}>
      <div className="relative">
        <label className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {labels?.uf ?? "Estado (UF)"} {required ? "*" : ""}
        </label>

        <div className="relative">
          <input
            ref={ufInputRef}
            value={ufQuery}
            onChange={(e) => {
              setUfQuery(e.target.value);
              setOpenUf(true);
              setOpenCity(false);
            }}
            onFocus={() => {
              setOpenUf(true);
              setOpenCity(false);
            }}
            onKeyDown={handleUfKeyDown}
            onBlur={() => {
              setTimeout(onBlurUf, 120);
            }}
            placeholder="Digite UF ou nome do estado"
            className="w-full rounded-xl border border-border/50 bg-input px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
            autoComplete="off"
            aria-expanded={openUf}
            aria-autocomplete="list"
            aria-haspopup="listbox"
          />

          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </div>

      <div className="relative">
        <label className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {labels?.city ?? "Cidade"} {required ? "*" : ""}
        </label>

        <div className="relative">
          <input
            ref={cityInputRef}
            value={cityQuery}
            onChange={(e) => {
              setCityQuery(e.target.value);
              setOpenCity(true);
              setOpenUf(false);
            }}
            onFocus={() => {
              setOpenCity(true);
              setOpenUf(false);
            }}
            onKeyDown={handleCityKeyDown}
            onBlur={() => {
              setTimeout(onBlurCity, 120);
            }}
            disabled={!UF || UF.length !== 2}
            placeholder={!UF ? "Selecione UF primeiro" : "Digite para buscar cidade"}
            className="w-full rounded-xl border border-border/50 bg-input px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            autoComplete="off"
            aria-expanded={openCity}
            aria-autocomplete="list"
            aria-haspopup="listbox"
          />

          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </div>

        <div className="mt-2 text-[11px] text-muted-foreground">
          {UF && UF.length === 2 ? (
            cityValid ? (
              <>
                Selecionado: <span className="font-medium text-foreground">{city}</span>
              </>
            ) : (
              <>Digite e selecione uma cidade válida.</>
            )
          ) : (
            <>Defina a UF para carregar as cidades.</>
          )}
        </div>
      </div>

      {openUf &&
        ufPos &&
        createPortal(
          <div
            className="fixed z-[9999] overflow-hidden rounded-2xl border border-border/50 bg-background/95 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl"
            style={{
              top: ufPos.top,
              left: ufPos.left,
              width: ufPos.width,
            }}
          >
            <div
              ref={ufListRef}
              className="overflow-y-auto overscroll-contain py-1"
              style={{ maxHeight: ufPos.maxHeight }}
              role="listbox"
            >
              {filteredUFs.map((item, index) => {
                const isActive = index === activeUfIndex;
                const isSelected = item.uf === UF;

                return (
                  <button
                    key={item.uf}
                    type="button"
                    data-uf-index={index}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveUfIndex(index)}
                    onClick={() => pickUF(item.uf)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition ${
                      isActive
                        ? "bg-primary/10 text-foreground"
                        : "text-foreground hover:bg-white/5"
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span>
                      <span className="font-medium">{item.uf}</span>
                      <span className="ml-2 text-muted-foreground">{item.name}</span>
                    </span>

                    {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}

      {openCity &&
        cityPos &&
        !loading &&
        UF &&
        UF.length === 2 &&
        filteredCities.length > 0 &&
        createPortal(
          <div
            className="fixed z-[9999] overflow-hidden rounded-2xl border border-border/50 bg-background/95 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl"
            style={{
              top: cityPos.top,
              left: cityPos.left,
              width: cityPos.width,
            }}
          >
            <div
              ref={cityListRef}
              className="overflow-y-auto overscroll-contain py-1"
              style={{ maxHeight: cityPos.maxHeight }}
              role="listbox"
            >
              {filteredCities.map((c, index) => {
                const isActive = index === activeCityIndex;
                const isSelected = c === city;

                return (
                  <button
                    key={c}
                    type="button"
                    data-city-index={index}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveCityIndex(index)}
                    onClick={() => pickCity(c)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition ${
                      isActive
                        ? "bg-primary/10 text-foreground"
                        : "text-foreground hover:bg-white/5"
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className={isSelected ? "font-medium" : ""}>{c}</span>
                    {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-border/30 px-4 py-2 text-[11px] text-muted-foreground">
              Selecione uma cidade válida da base IBGE.
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}