import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";

type Props = {
  uf: string;
  city: string;
  onChange: (next: { uf: string; city: string; cityValid: boolean }) => void;
  required?: boolean;
};

const STATES = [
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

const citiesCache: Record<string, string[]> = {};

async function fetchCities(uf: string) {
  if (citiesCache[uf]) return citiesCache[uf];

  const res = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
  );

  const data = await res.json();
  const cities = data.map((c: any) => c.nome);

  citiesCache[uf] = cities;

  return cities;
}

export default function CityUfPicker({ uf, city, onChange, required }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [ufQuery, setUfQuery] = useState(uf);
  const [cityQuery, setCityQuery] = useState(city);

  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  const [openState, setOpenState] = useState(false);
  const [openCity, setOpenCity] = useState(false);

  useEffect(() => {
    const clickOutside = (e: any) => {
      if (!wrapperRef.current?.contains(e.target)) {
        setOpenState(false);
        setOpenCity(false);
      }
    };

    document.addEventListener("mousedown", clickOutside);
    document.addEventListener("touchstart", clickOutside);

    return () => {
      document.removeEventListener("mousedown", clickOutside);
      document.removeEventListener("touchstart", clickOutside);
    };
  }, []);

  useEffect(() => {
    if (!uf) return;

    setLoadingCities(true);

    fetchCities(uf)
      .then((list) => setCities(list))
      .finally(() => setLoadingCities(false));
  }, [uf]);

  const filteredStates = useMemo(() => {
    const q = ufQuery.toLowerCase();

    return STATES.filter(
      (s) =>
        s.uf.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q)
    );
  }, [ufQuery]);

  const filteredCities = useMemo(() => {
    const q = cityQuery.toLowerCase();

    return cities
      .filter((c) => c.toLowerCase().includes(q))
      .slice(0, 40);
  }, [cityQuery, cities]);

  const selectState = (ufValue: string) => {
    onChange({ uf: ufValue, city: "", cityValid: false });

    setUfQuery(ufValue);
    setCityQuery("");

    setOpenState(false);
  };

  const selectCity = (cityValue: string) => {
    onChange({ uf, city: cityValue, cityValid: true });

    setCityQuery(cityValue);
    setOpenCity(false);
  };

  return (
    <div ref={wrapperRef} className="space-y-4">
      {/* ESTADO */}
      <div className="relative">
        <label className="text-xs uppercase text-muted-foreground flex gap-2 mb-2">
          <MapPin size={14} />
          Estado {required && "*"}
        </label>

        <input
          value={ufQuery}
          onChange={(e) => {
            setUfQuery(e.target.value);
            setOpenState(true);
          }}
          onFocus={() => setOpenState(true)}
          placeholder="Digite seu estado"
          className="w-full rounded-xl border border-border/50 bg-input px-4 py-3 text-sm"
        />

        {openState && (
          <div className="absolute z-50 w-full bg-background border border-border/40 rounded-xl mt-2 shadow-xl max-h-60 overflow-y-auto">
            {filteredStates.map((s) => (
              <button
                key={s.uf}
                type="button"
                onClick={() => selectState(s.uf)}
                className="w-full text-left px-4 py-3 hover:bg-muted/40 text-sm"
              >
                {s.uf} — {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CIDADE */}
      <div className="relative">
        <label className="text-xs uppercase text-muted-foreground flex gap-2 mb-2">
          <MapPin size={14} />
          Cidade {required && "*"}
        </label>

        <input
          value={cityQuery}
          disabled={!uf}
          onChange={(e) => {
            setCityQuery(e.target.value);
            setOpenCity(true);
          }}
          onFocus={() => setOpenCity(true)}
          placeholder={uf ? "Digite sua cidade" : "Escolha o estado primeiro"}
          className="w-full rounded-xl border border-border/50 bg-input px-4 py-3 text-sm disabled:opacity-50"
        />

        {loadingCities && (
          <Loader2 className="absolute right-3 top-3 animate-spin" size={18} />
        )}

        {openCity && filteredCities.length > 0 && (
          <div className="absolute z-50 w-full bg-background border border-border/40 rounded-xl mt-2 shadow-xl max-h-60 overflow-y-auto">
            {filteredCities.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => selectCity(c)}
                className="w-full text-left px-4 py-3 hover:bg-muted/40 text-sm"
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}