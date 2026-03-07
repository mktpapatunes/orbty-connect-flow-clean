import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, Search, Check, ChevronRight, Loader2, X } from "lucide-react";

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
] as const;

const cityCache: Record<string, string[]> = {};

function normalizeText(value: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function fetchCitiesByUf(uf: string) {
  if (!uf) return [];
  if (cityCache[uf]) return cityCache[uf];

  const res = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
  );

  if (!res.ok) return [];

  const data = await res.json();
  const cities = (data as Array<{ nome: string }>)
    .map((item) => item.nome)
    .filter(Boolean);

  cityCache[uf] = cities;
  return cities;
}

type PickerSheetProps = {
  open: boolean;
  title: string;
  searchPlaceholder: string;
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  loading?: boolean;
  items: Array<{
    id: string;
    title: string;
    subtitle?: string;
    selected?: boolean;
    onSelect: () => void;
  }>;
  emptyText: string;
};

function PickerSheet({
  open,
  title,
  searchPlaceholder,
  query,
  onQueryChange,
  onClose,
  loading,
  items,
  emptyText,
}: PickerSheetProps) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120]">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />

      <div className="absolute inset-x-0 bottom-0 rounded-t-[28px] border-t border-border/40 bg-background shadow-2xl">
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />

        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-border/50 bg-input px-10 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {loading ? (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}
          </div>
        </div>

        <div className="max-h-[62vh] overflow-y-auto px-2 pb-5">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : items.length > 0 ? (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onSelect}
                className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {item.title}
                  </div>
                  {item.subtitle ? (
                    <div className="truncate text-xs text-muted-foreground">
                      {item.subtitle}
                    </div>
                  ) : null}
                </div>

                {item.selected ? (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            ))
          ) : (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {emptyText}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function CityUfPicker({
  uf,
  city,
  onChange,
  required,
}: Props) {
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  const [stateSheetOpen, setStateSheetOpen] = useState(false);
  const [citySheetOpen, setCitySheetOpen] = useState(false);

  const [stateQuery, setStateQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");

  useEffect(() => {
    if (!uf) {
      setCities([]);
      return;
    }

    let cancelled = false;
    setLoadingCities(true);

    fetchCitiesByUf(uf)
      .then((list) => {
        if (!cancelled) setCities(list);
      })
      .finally(() => {
        if (!cancelled) setLoadingCities(false);
      });

    return () => {
      cancelled = true;
    };
  }, [uf]);

  const selectedState = useMemo(() => {
    return STATES.find((item) => item.uf === uf) ?? null;
  }, [uf]);

  const filteredStates = useMemo(() => {
    const q = normalizeText(stateQuery);
    if (!q) return STATES;

    return STATES.filter((item) => {
      return (
        normalizeText(item.uf).includes(q) ||
        normalizeText(item.name).includes(q)
      );
    });
  }, [stateQuery]);

  const filteredCities = useMemo(() => {
    const q = normalizeText(cityQuery);
    if (!q) return cities.slice(0, 80);

    return cities
      .filter((item) => normalizeText(item).includes(q))
      .slice(0, 80);
  }, [cityQuery, cities]);

  const cityValid = !!city && cities.includes(city);

  const openStateSheet = () => {
    setStateQuery("");
    setStateSheetOpen(true);
  };

  const openCitySheet = () => {
    if (!uf) return;
    setCityQuery("");
    setCitySheetOpen(true);
  };

  const selectState = (nextUf: string) => {
    onChange({
      uf: nextUf,
      city: "",
      cityValid: false,
    });
    setStateSheetOpen(false);
    setCitySheetOpen(false);
  };

  const selectCity = (nextCity: string) => {
    onChange({
      uf,
      city: nextCity,
      cityValid: true,
    });
    setCitySheetOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Estado */}
      <div>
        <label className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          Estado {required ? "*" : ""}
        </label>

        <button
          type="button"
          onClick={openStateSheet}
          className="flex w-full items-center justify-between rounded-xl border border-border/50 bg-input px-4 py-3 text-left text-sm text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <span className={selectedState ? "text-foreground" : "text-muted-foreground/60"}>
            {selectedState ? `${selectedState.uf} — ${selectedState.name}` : "Selecione seu estado"}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Cidade */}
      <div>
        <label className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          Cidade {required ? "*" : ""}
        </label>

        <button
          type="button"
          onClick={openCitySheet}
          disabled={!uf}
          className="flex w-full items-center justify-between rounded-xl border border-border/50 bg-input px-4 py-3 text-left text-sm text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className={city ? "text-foreground" : "text-muted-foreground/60"}>
            {city || "Selecione sua cidade"}
          </span>

          {loadingCities ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        <div className="mt-2 text-[11px] text-muted-foreground">
          {!uf
            ? "Defina o estado para carregar as cidades."
            : cityValid
            ? <>Selecionado: <span className="font-medium text-foreground">{city}</span></>
            : "Selecione uma cidade válida da base IBGE."}
        </div>
      </div>

      <PickerSheet
        open={stateSheetOpen}
        title="Selecionar estado"
        searchPlaceholder="Digite UF ou nome do estado"
        query={stateQuery}
        onQueryChange={setStateQuery}
        onClose={() => setStateSheetOpen(false)}
        items={filteredStates.map((item) => ({
          id: item.uf,
          title: `${item.uf} — ${item.name}`,
          selected: item.uf === uf,
          onSelect: () => selectState(item.uf),
        }))}
        emptyText="Nenhum estado encontrado."
      />

      <PickerSheet
        open={citySheetOpen}
        title="Selecionar cidade"
        searchPlaceholder={uf ? "Digite o nome da cidade" : "Escolha o estado primeiro"}
        query={cityQuery}
        onQueryChange={setCityQuery}
        onClose={() => setCitySheetOpen(false)}
        loading={loadingCities}
        items={filteredCities.map((item) => ({
          id: item,
          title: item,
          selected: item === city,
          onSelect: () => selectCity(item),
        }))}
        emptyText={
          uf
            ? "Nenhuma cidade encontrada."
            : "Escolha um estado antes de selecionar a cidade."
        }
      />
    </div>
  );
}