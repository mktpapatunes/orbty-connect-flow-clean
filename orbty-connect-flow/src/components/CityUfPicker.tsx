import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Loader2, ChevronDown } from "lucide-react";

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
  const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${UF}/municipios`, { signal });
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

export default function CityUfPicker({ uf, city, onChange, labels, required }: Props) {
  const [loading, setLoading] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [query, setQuery] = useState(city || "");
  const [open, setOpen] = useState(false);

  const cacheRef = useRef<Record<string, string[]>>({});
  const abortRef = useRef<AbortController | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const UF = normalizeUF(uf);

  const cityValid = useMemo(() => {
    const c = (city || "").trim();
    if (!UF || UF.length !== 2) return false;
    if (!c) return false;
    const list = cacheRef.current[UF] || cities;
    return list.includes(c);
  }, [UF, city, cities]);

  // click outside close
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  // load cities when UF changes
  useEffect(() => {
    let alive = true;

    if (!UF || UF.length !== 2) {
      setCities([]);
      setOpen(false);
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

  // sync query
  useEffect(() => {
    setQuery(city || "");
  }, [city]);

  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    const list = cities || [];
    if (!q) return list.slice(0, 24);
    return list.filter((x) => x.toLowerCase().startsWith(q)).slice(0, 24);
  }, [query, cities]);

  const setUF = (value: string) => {
    const nextUF = normalizeUF(value);
    // ao trocar UF, zera cidade
    onChange({ uf: nextUF, city: "", cityValid: false });
    setQuery("");
    setOpen(false);
  };

  const pickCity = (value: string) => {
    const v = (value || "").trim();
    onChange({ uf: UF, city: v, cityValid: true });
    setQuery(v);
    setOpen(false);
  };

  const onBlurCity = () => {
    // se não estiver na lista IBGE → limpa e marca inválido
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

  return (
    <div className="space-y-3" ref={wrapRef}>
      {/* UF */}
      <div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
          <MapPin className="w-3.5 h-3.5" />
          {labels?.uf ?? "Estado (UF)"} {required ? "*" : ""}
        </label>

        <input
          value={UF}
          onChange={(e) => setUF(e.target.value)}
          placeholder="SP"
          className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all uppercase"
          list="uf-list"
          inputMode="text"
          autoComplete="off"
        />
        <datalist id="uf-list">
          {UF_OPTIONS.map((x) => (
            <option key={x.uf} value={x.uf}>
              {x.name}
            </option>
          ))}
        </datalist>
      </div>

      {/* City (IBGE enforced) */}
      <div className="relative">
        <label className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
          <MapPin className="w-3.5 h-3.5" />
          {labels?.city ?? "Cidade"} {required ? "*" : ""}
        </label>

        <div className="relative">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              // delay para permitir clique no item
              setTimeout(onBlurCity, 120);
            }}
            disabled={!UF || UF.length !== 2}
            placeholder={!UF ? "Selecione UF primeiro" : "Digite para buscar (IBGE)"}
            className={`w-full bg-input border rounded-xl px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all ${
              city && cityValid ? "border-border/50" : "border-border/50"
            } disabled:opacity-60`}
            autoComplete="off"
          />

          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
          </div>

          {open && !loading && UF && UF.length === 2 && filtered.length > 0 && (
            <div className="absolute z-20 mt-2 w-full rounded-xl border border-border/50 bg-background/95 backdrop-blur-xl shadow-lg overflow-hidden">
              <div className="max-h-64 overflow-auto">
                {filtered.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickCity(c)}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition"
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-border/30 text-[11px] text-muted-foreground">
                Cidade válida somente selecionando da lista IBGE.
              </div>
            </div>
          )}
        </div>

        {/* Hint */}
        <div className="mt-2 text-[11px] text-muted-foreground">
          {UF && UF.length === 2 ? (
            cityValid ? (
              <>Selecionado: <span className="text-foreground font-medium">{city}</span></>
            ) : (
              <>Digite e selecione uma cidade válida (IBGE).</>
            )
          ) : (
            <>Defina a UF para carregar as cidades.</>
          )}
        </div>
      </div>
    </div>
  );
}