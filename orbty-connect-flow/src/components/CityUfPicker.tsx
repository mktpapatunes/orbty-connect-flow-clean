import { useEffect, useMemo, useRef, useState } from "react";
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

async function fetchCitiesByUF(uf: string, signal?: AbortSignal): Promise<string[]> {
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

export default function CityUfPicker({
  uf,
  city,
  onChange,
  labels,
  required,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [query, setQuery] = useState(city || "");
  const [openCity, setOpenCity] = useState(false);
  const [openUf, setOpenUf] = useState(false);
  const [activeCityIndex, setActiveCityIndex] = useState<number>(-1);
  const [activeUfIndex, setActiveUfIndex] = useState<number>(-1);

  const cacheRef = useRef<Record<string, string[]>>({});
  const abortRef = useRef<AbortController | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const ufWrapRef = useRef<HTMLDivElement | null>(null);
  const cityWrapRef = useRef<HTMLDivElement | null>(null);
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
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;

      if (ufWrapRef.current && !ufWrapRef.current.contains(target)) {
        setOpenUf(false);
        setActiveUfIndex(-1);
      }

      if (cityWrapRef.current && !cityWrapRef.current.contains(target)) {
        setOpenCity(false);
        setActiveCityIndex(-1);
      }

      if (wrapRef.current && !wrapRef.current.contains(target)) {
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

  useEffect(() => {
    setQuery(city || "");
  }, [city]);

  const filteredCities = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    const list = cities || [];

    if (!q) return list.slice(0, 24);

    return list.filter((x) => x.toLowerCase().includes(q)).slice(0, 24);
  }, [query, cities]);

  useEffect(() => {
    if (openUf) {
      const idx = Math.max(
        0,
        UF_OPTIONS.findIndex((item) => item.uf === UF)
      );
      setActiveUfIndex(idx >= 0 ? idx : 0);
    }
  }, [openUf, UF]);

  useEffect(() => {
    setActiveCityIndex(filteredCities.length > 0 ? 0 : -1);
  }, [query, UF]);

  useEffect(() => {
    if (!openUf || activeUfIndex < 0 || !ufListRef.current) return;

    const container = ufListRef.current;
    const activeEl = container.querySelector<HTMLElement>(
      `[data-uf-index="${activeUfIndex}"]`
    );

    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeUfIndex, openUf]);

  useEffect(() => {
    if (!openCity || activeCityIndex < 0 || !cityListRef.current) return;

    const container = cityListRef.current;
    const activeEl = container.querySelector<HTMLElement>(
      `[data-city-index="${activeCityIndex}"]`
    );

    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeCityIndex, openCity]);

  const setUFValue = (value: string) => {
    const nextUF = normalizeUF(value);
    onChange({ uf: nextUF, city: "", cityValid: false });
    setQuery("");
    setOpenUf(false);
    setOpenCity(false);
    setActiveUfIndex(-1);
    setActiveCityIndex(-1);
  };

  const pickCity = (value: string) => {
    const v = (value || "").trim();
    onChange({ uf: UF, city: v, cityValid: true });
    setQuery(v);
    setOpenCity(false);
    setActiveCityIndex(-1);
  };

  const onBlurCity = () => {
    const q = (query || "").trim();

    if (!q) {
      onChange({ uf: UF, city: "", cityValid: false });
      return;
    }

    const list = cacheRef.current[UF] || cities;

    if (!list.includes(q)) {
      onChange({ uf: UF, city: "", cityValid: false });
      setQuery("");
    } else {
      onChange({ uf: UF, city: q, cityValid: true });
    }
  };

  const handleUfKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!openUf && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setOpenUf(true);
      return;
    }

    if (!UF_OPTIONS.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveUfIndex((prev) => (prev < UF_OPTIONS.length - 1 ? prev + 1 : 0));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveUfIndex((prev) => (prev > 0 ? prev - 1 : UF_OPTIONS.length - 1));
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (openUf && activeUfIndex >= 0 && UF_OPTIONS[activeUfIndex]) {
        setUFValue(UF_OPTIONS[activeUfIndex].uf);
      }
      return;
    }

    if (e.key === "Escape") {
      setOpenUf(false);
      setActiveUfIndex(-1);
    }
  };

  const handleCityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!openCity && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpenCity(true);
      return;
    }

    if (!filteredCities.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveCityIndex((prev) => (prev < filteredCities.length - 1 ? prev + 1 : 0));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveCityIndex((prev) => (prev > 0 ? prev - 1 : filteredCities.length - 1));
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
      setActiveCityIndex(-1);
    }
  };

  return (
    <div className="space-y-3" ref={wrapRef}>
      {/* UF */}
      <div className="relative" ref={ufWrapRef}>
        <label className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {labels?.uf ?? "Estado (UF)"} {required ? "*" : ""}
        </label>

        <button
          type="button"
          onClick={() => {
            setOpenUf((prev) => !prev);
            setOpenCity(false);
          }}
          onKeyDown={handleUfKeyDown}
          className="flex w-full items-center justify-between rounded-xl border border-border/50 bg-input px-4 py-3 text-sm text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
          aria-expanded={openUf}
          aria-haspopup="listbox"
        >
          <span className={selectedUfOption ? "text-foreground" : "text-muted-foreground/60"}>
            {selectedUfOption ? `${selectedUfOption.uf} • ${selectedUfOption.name}` : "Selecione o estado"}
          </span>

          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              openUf ? "rotate-180" : ""
            }`}
          />
        </button>

        {openUf && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border/50 bg-background/95 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <div
              ref={ufListRef}
              className="max-h-64 overflow-y-auto overscroll-contain py-1"
              role="listbox"
            >
              {UF_OPTIONS.map((item, index) => {
                const isActive = index === activeUfIndex;
                const isSelected = item.uf === UF;

                return (
                  <button
                    key={item.uf}
                    type="button"
                    data-uf-index={index}
                    onMouseEnter={() => setActiveUfIndex(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setUFValue(item.uf)}
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
          </div>
        )}
      </div>

      {/* Cidade */}
      <div className="relative" ref={cityWrapRef}>
        <label className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {labels?.city ?? "Cidade"} {required ? "*" : ""}
        </label>

        <div className="relative">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
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

          {openCity && !loading && UF && UF.length === 2 && filteredCities.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border/50 bg-background/95 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <div
                ref={cityListRef}
                className="max-h-64 overflow-y-auto overscroll-contain py-1"
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
            </div>
          )}
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
    </div>
  );
}