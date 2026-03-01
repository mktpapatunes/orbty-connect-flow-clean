// src/pages/profile/InfluencerProfile.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import MobileLayout from "@/components/MobileLayout";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useMyProfileContext } from "@/hooks/useMyProfileContext";
import { updateMyInstagramStats } from "@/services/profile";
import { updateMyAvatarWithUpload } from "@/services/profileAvatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Instagram,
  Users,
  MapPin,
  Save,
  X,
  Camera,
  Pencil,
  Shield,
  Sparkles,
  Map,
  Building2,
  Home,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useNavigate } from "react-router-dom";

/* =========================
   UI helpers
========================= */

const BIO_LIMIT = 28;

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function clampInt(n: number, min: number, max: number) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function initials(name?: string | null) {
  const n = (name || "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function buildInstagramLinks(handle?: string | null) {
  const raw = (handle || "").trim().replace(/^@/, "");
  if (!raw) return null;
  return {
    raw,
    web: `https://instagram.com/${raw}`,
    app: `instagram://user?username=${raw}`,
  };
}

function openInstagram(handle?: string | null) {
  const links = buildInstagramLinks(handle);
  if (!links) return;

  const opened = window.open(links.app, "_blank", "noopener,noreferrer");
  if (!opened) window.open(links.web, "_blank", "noopener,noreferrer");
  else {
    setTimeout(() => {
      try {
        window.open(links.web, "_blank", "noopener,noreferrer");
      } catch {
        // ignore
      }
    }, 450);
  }
}

function openMapsQuery(query: string) {
  const q = encodeURIComponent((query || "").trim());
  if (!q) return;
  window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener,noreferrer");
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

function formatBRInt(n: number) {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  return v.toLocaleString("pt-BR");
}

function parseDigitsOnly(v: string) {
  return (v || "").replace(/[^\d]/g, "");
}

function SectionShell(props: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass-card p-5 shadow-sm transition hover:shadow-md hover:bg-white/[0.06] ${props.className ?? ""}`}>
      <div>
        <div className="text-sm font-semibold text-foreground">{props.title}</div>
        {props.subtitle ? <div className="text-xs text-muted-foreground mt-1">{props.subtitle}</div> : null}
      </div>
      <div className="mt-4">{props.children}</div>
    </div>
  );
}

function SkeletonLine({ w = "100%", h = 12 }: { w?: string; h?: number }) {
  return <div className="animate-pulse rounded-xl bg-white/10" style={{ width: w, height: h }} />;
}

function IconButton(props: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={`inline-flex items-center gap-2 rounded-xl border border-border/50 bg-white/5 px-3 py-2 text-sm text-foreground transition
      hover:bg-white/10 hover:shadow-sm active:scale-[0.99]
      disabled:opacity-60 disabled:hover:bg-white/5 ${props.className ?? ""}`}
    >
      <span className="text-primary">{props.icon}</span>
      <span className="truncate">{props.label}</span>
    </button>
  );
}

function MicroChip(props: { icon: React.ReactNode; label: string; value: string; title?: string }) {
  return (
    <div
      title={props.title}
      className="h-12 min-w-0 flex items-center gap-2 rounded-2xl border border-border/50 bg-white/5 px-3
      text-[11px] text-foreground/90 shadow-sm"
    >
      <span className="text-primary shrink-0">{props.icon}</span>

      <div className="min-w-0 leading-tight">
        <div className="text-[10px] text-muted-foreground whitespace-nowrap">{props.label}:</div>
        <div className="text-xs font-semibold truncate whitespace-nowrap">{props.value}</div>
      </div>
    </div>
  );
}

function LocationInfoChip(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
  title?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const disabled = props.disabled || !props.onClick;

  return (
    <button
      type="button"
      title={props.title}
      onClick={disabled ? undefined : props.onClick}
      disabled={disabled}
      className={`h-12 min-w-0 flex items-center gap-2 rounded-2xl border border-border/50 bg-white/5 px-3
      text-[11px] text-foreground/90 shadow-sm transition
      ${disabled ? "opacity-70" : "hover:bg-white/10 hover:shadow-md active:scale-[0.99]"}`}
    >
      <span className="text-primary shrink-0">{props.icon}</span>

      <div className="min-w-0 leading-tight text-left">
        <div className="text-[10px] text-muted-foreground whitespace-nowrap">{props.label}:</div>
        <div className="text-xs font-semibold truncate whitespace-nowrap">{props.value || "—"}</div>
      </div>

      {!disabled ? <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : null}
    </button>
  );
}

/** ✅ Avaliações */
function StarRating(props: { value: number; max?: number; className?: string }) {
  const max = props.max ?? 5;
  const v = Math.max(0, Math.min(max, Number(props.value ?? 0)));
  const full = Math.round(v);

  return (
    <div className={`flex items-center justify-center gap-1 ${props.className ?? ""}`} aria-label={`Avaliação: ${full} de ${max}`}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < full;
        return (
          <span
            key={i}
            className={`text-[26px] leading-none select-none ${filled ? "text-yellow-400" : "text-white/20"}`}
            aria-hidden="true"
          >
            ★
          </span>
        );
      })}
    </div>
  );
}

function RatingsCard(props: { rating: number; count?: number | null; loading?: boolean }) {
  if (props.loading) {
    return (
      <div className="glass-card p-5 shadow-sm transition hover:shadow-md hover:bg-white/[0.06]">
        <div className="text-sm font-semibold text-foreground text-center">Avaliações</div>
        <div className="mt-4 flex justify-center">
          <SkeletonLine w="180px" h={22} />
        </div>
        <div className="mt-3 flex justify-center">
          <SkeletonLine w="140px" h={10} />
        </div>
      </div>
    );
  }

  const safeRating = Math.max(0, Math.min(5, Number(props.rating ?? 0)));
  const count = props.count ?? null;

  return (
    <div className="glass-card p-5 shadow-sm transition hover:shadow-md hover:bg-white/[0.06]">
      <div className="text-sm font-semibold text-foreground text-center">Avaliações</div>

      <div className="mt-3">
        <StarRating value={safeRating} />
      </div>

      <div className="mt-2 text-center text-xs text-muted-foreground">
        {count && count > 0 ? `${safeRating.toFixed(1).replace(".", ",")} · ${count} avaliações` : "Sem avaliações ainda"}
      </div>
    </div>
  );
}

/** ✅ Ativações e campanhas */
function SingleStatCard(props: { title: string; label: string; value: React.ReactNode; loading?: boolean }) {
  return (
    <div className="glass-card p-5 shadow-sm transition hover:shadow-md hover:bg-white/[0.06]">
      <div className="text-sm font-semibold text-foreground text-center">{props.title}</div>

      {props.loading ? (
        <div className="mt-4 space-y-2">
          <div className="flex justify-center">
            <SkeletonLine w="42%" h={18} />
          </div>
          <div className="flex justify-center">
            <SkeletonLine w="64%" h={10} />
          </div>
        </div>
      ) : (
        <div className="mt-4 text-center">
          <div className="text-xs text-muted-foreground">{props.label}</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{props.value}</div>
        </div>
      )}
    </div>
  );
}

/** Donut dual via SVG */
function DualDonutChart(props: { aPct: number; bPct: number; label: string; aLabel: string; bLabel: string }) {
  const a = clamp(props.aPct, 0, 100);
  const b = clamp(props.bPct, 0, 100);

  const size = 108;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const aDash = (a / 100) * c;
  const bDash = (b / 100) * c;

  const aOffset = 0;
  const bOffset = aDash;

  return (
    <div className="rounded-2xl border border-border/50 bg-white/5 p-4 shadow-sm transition hover:bg-white/10 hover:shadow-md hover:-translate-y-[1px] active:scale-[0.99]">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{props.label}</div>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div className="relative w-[108px] h-[108px] shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="rgba(236,72,153,0.75)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${aDash} ${c - aDash}`}
              strokeDashoffset={-aOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="rgba(59,130,246,0.75)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${bDash} ${c - bDash}`}
              strokeDashoffset={-bOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-lg font-semibold text-foreground">{Math.round(a)}%</div>
            <div className="text-[10px] text-muted-foreground -mt-1">{props.aLabel}</div>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{props.aLabel}</span>
            <span className="text-foreground font-medium">{Math.round(a)}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-pink-500/60" style={{ width: `${a}%` }} />
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-muted-foreground">{props.bLabel}</span>
            <span className="text-foreground font-medium">{Math.round(b)}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-blue-500/60" style={{ width: `${b}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** ✅ Faixa etária em barras */
function AgeBarsCard(props: { data: Record<string, number> | null; buckets: string[] }) {
  const normalized = useMemo(() => {
    const raw = props.data || {};
    const values = props.buckets.map((k) => {
      const v = Number(raw[k] ?? 0);
      return Number.isFinite(v) ? Math.max(0, v) : 0;
    });
    const total = values.reduce((a, b) => a + b, 0);

    return props.buckets.map((k, idx) => {
      const v = values[idx] ?? 0;
      const pct = total > 0 ? (v / total) * 100 : 0;
      return { key: k, pct };
    });
  }, [props.data, props.buckets]);

  const hasAny = normalized.some((x) => x.pct > 0);

  return (
    <div className="rounded-2xl border border-border/50 bg-white/5 p-4 shadow-sm transition hover:bg-white/10 hover:shadow-md hover:-translate-y-[1px] active:scale-[0.99]">
      <div className="text-xs text-muted-foreground">Faixa etária</div>

      {!hasAny ? (
        <div className="mt-3 text-sm text-muted-foreground">Sem dados de faixa etária.</div>
      ) : (
        <div className="mt-4 space-y-3">
          {normalized.map((row) => (
            <div key={row.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{row.key}</span>
                <span className="text-foreground font-medium">{Math.round(row.pct)}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-white/30" style={{ width: `${clamp(row.pct, 0, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================
   Types / parsing
========================= */

type ObjNum = Record<string, number>;

const AGE_BARS_BUCKETS = ["18-24", "25-34", "35-44", "45-54", "55-64"] as const;

function parseObjectNumbers(v: any): ObjNum | null {
  if (!v || typeof v !== "object") return null;
  const out: ObjNum = {};
  for (const [k, val] of Object.entries(v)) {
    const num = Number(val);
    if (!Number.isNaN(num)) out[String(k)] = num;
  }
  return Object.keys(out).length ? out : null;
}

function safeCommaListToArray(v?: string | null) {
  const raw = (v || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !["null", "undefined", "-", "—"].includes(s.toLowerCase()))
    .slice(0, 1);
}

/* =========================
   UF / Cities (IBGE)
========================= */

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

function ufToName(uf: string) {
  const U = normalizeUF(uf);
  const found = UF_OPTIONS.find((x) => x.uf === U);
  return found?.name || U || "";
}

async function fetchCitiesByUF(uf: string, signal?: AbortSignal): Promise<string[]> {
  const UF = normalizeUF(uf);
  if (!UF || UF.length !== 2) return [];
  const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${UF}/municipios`, { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{ nome: string }>;
  return (data || []).map((x) => x?.nome).filter(Boolean);
}

/* =========================
   Page
========================= */

export default function InfluencerProfile() {
  const navigate = useNavigate();
  const { profile, userRole, approvalStatus, refreshProfile } = useAuth();
  const ctx = useMyProfileContext();

  const isVerifiedInfluencer = userRole === "influencer" && approvalStatus === "approved";

  // Avatar upload
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const handlePickAvatar = () => fileRef.current?.click();

  const handleAvatarFile = async (file?: File | null) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 5MB.");
      return;
    }

    setAvatarUploading(true);
    try {
      await updateMyAvatarWithUpload(file);
      toast.success("Foto atualizada!");
      await refreshProfile();
      await ctx.refetch();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar foto.");
    } finally {
      setAvatarUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Instagram stats (ctx preferencial)
  const instagram = useMemo(() => {
    const rpcIg = (ctx.data as any)?.instagram;
    if (rpcIg) return rpcIg;

    const followersRaw = (profile as any)?.followers as string | undefined;
    const followers = followersRaw ? Number(String(followersRaw).replace(/[^\d]/g, "")) : null;

    const ag = (profile as any)?.audience_gender;
    const female = typeof ag?.female === "number" ? ag.female : 50;
    const male = typeof ag?.male === "number" ? ag.male : 50;

    return {
      platform: "instagram",
      source: "self_reported",
      instagram_username: (profile as any)?.instagram ?? null,
      followers_count: Number.isFinite(followers) ? followers : null,
      audience_female_pct: female,
      audience_male_pct: male,
      audience_region: null,
      collected_at: null,
    };
  }, [ctx.data, profile]);

  const audienceAge = useMemo<ObjNum | null>(() => {
    return parseObjectNumbers((profile as any)?.audience_age) || parseObjectNumbers((ctx.data as any)?.audience_age) || null;
  }, [profile, ctx.data]);

  // ✅ Avaliações reais (via view influencer_rating_summary)
  const [ratingAvg, setRatingAvg] = useState<number>(0);
  const [ratingCount, setRatingCount] = useState<number | null>(null);
  const [loadingRatings, setLoadingRatings] = useState<boolean>(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!profile?.id) return;

      setLoadingRatings(true);
      try {
        const { data, error } = await supabase
          .from("influencer_rating_summary")
          .select("avg_rating, rating_count")
          .eq("influencer_id", profile.id)
          .maybeSingle();

        if (!alive) return;

        if (error) {
          console.error("Erro ao buscar influencer_rating_summary:", error);
          setRatingAvg(0);
          setRatingCount(null);
          setLoadingRatings(false);
          return;
        }

        if (!data) {
          setRatingAvg(0);
          setRatingCount(null);
          setLoadingRatings(false);
          return;
        }

        const avg = Number((data as any).avg_rating ?? 0);
        const cnt = Number((data as any).rating_count ?? 0);

        setRatingAvg(Number.isFinite(avg) ? avg : 0);
        setRatingCount(Number.isFinite(cnt) ? cnt : null);
        setLoadingRatings(false);
      } catch (e) {
        if (!alive) return;
        console.error(e);
        setRatingAvg(0);
        setRatingCount(null);
        setLoadingRatings(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [profile?.id]);

  const [orbtyAccepted, setOrbtyAccepted] = useState(0);
  const [loadingOrbty, setLoadingOrbty] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!profile?.id) return;
      setLoadingOrbty(true);

      const rpcMetrics = (ctx.data as any)?.influencer_metrics;
      if (rpcMetrics) {
        if (!alive) return;
        setOrbtyAccepted(Number(rpcMetrics.accepted_applications ?? 0));
        setLoadingOrbty(false);
        return;
      }

      const { data, error } = await supabase.from("campaign_applications").select("status").eq("influencer_id", profile.id);

      if (!alive) return;

      if (error) {
        console.error(error);
        setLoadingOrbty(false);
        return;
      }

      const list = data ?? [];
      setOrbtyAccepted(list.filter((x: any) => x.status === "accepted").length);
      setLoadingOrbty(false);
    })();

    return () => {
      alive = false;
    };
  }, [profile?.id, ctx.data]);

  const igHandle = (profile as any)?.instagram ?? null;
  const igRaw = buildInstagramLinks(igHandle)?.raw ?? null;

  const followersLabel =
    instagram?.followers_count === null || instagram?.followers_count === undefined
      ? "—"
      : Number(instagram.followers_count).toLocaleString("pt-BR");

  const followersCompact = useMemo(() => {
    const n = instagram?.followers_count ?? null;
    return formatIGCount(typeof n === "number" ? n : Number(n));
  }, [instagram?.followers_count]);

  const femalePct = clamp(Number(instagram?.audience_female_pct ?? 50), 0, 100);
  const malePct = clamp(Number(instagram?.audience_male_pct ?? (100 - femalePct)), 0, 100);

  const contentStyles = useMemo(() => safeCommaListToArray((profile as any)?.content_style ?? ""), [profile]);
  const primaryStyle = contentStyles?.[0] ?? "—";

  const headerBio = ((profile as any)?.bio as string | null | undefined)?.trim() ?? "";
  const [bioOpen, setBioOpen] = useState(false);
  const showBioMore = useMemo(() => headerBio.length > 140, [headerBio]);

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // cidades IBGE (cache por UF)
  const citiesCacheRef = useRef<Record<string, string[]>>({});
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const cityFetchAbortRef = useRef<AbortController | null>(null);

  const initialFollowersDigits = useMemo(() => {
    const n = Number(instagram?.followers_count ?? 0);
    return n > 0 ? String(Math.floor(n)) : "";
  }, [instagram?.followers_count]);

  const [form, setForm] = useState(() => ({
    name: (profile as any)?.name ?? "",
    state: (profile as any)?.state ?? "",
    city: (profile as any)?.city ?? "",
    neighborhood: (profile as any)?.neighborhood ?? "",
    bio: String((profile as any)?.bio ?? "").slice(0, BIO_LIMIT),

    instagram_username: (profile as any)?.instagram ?? "",
    followers_digits: initialFollowersDigits,

    female_str: String(femalePct),
    male_str: String(malePct),

    age_18_24: clampInt(Number(audienceAge?.["18-24"] ?? 0), 0, 100),
    age_25_34: clampInt(Number(audienceAge?.["25-34"] ?? 0), 0, 100),
    age_35_44: clampInt(Number(audienceAge?.["35-44"] ?? 0), 0, 100),
    age_45_54: clampInt(Number(audienceAge?.["45-54"] ?? 0), 0, 100),
    age_55_64: clampInt(Number(audienceAge?.["55-64"] ?? 0), 0, 100),

    content_style_one: safeCommaListToArray((profile as any)?.content_style ?? "")?.[0] ?? "",
  }));

  useEffect(() => {
    if (!editOpen) return;

    setForm({
      name: (profile as any)?.name ?? "",
      state: (profile as any)?.state ?? "",
      city: (profile as any)?.city ?? "",
      neighborhood: (profile as any)?.neighborhood ?? "",
      bio: String((profile as any)?.bio ?? "").slice(0, BIO_LIMIT),

      instagram_username: (profile as any)?.instagram ?? "",

      followers_digits: (() => {
        const n = Number(instagram?.followers_count ?? 0);
        return n > 0 ? String(Math.floor(n)) : "";
      })(),

      female_str: String(clamp(Number(instagram?.audience_female_pct ?? 50), 0, 100)),
      male_str: String(clamp(Number(instagram?.audience_male_pct ?? 50), 0, 100)),

      age_18_24: clampInt(Number(audienceAge?.["18-24"] ?? 0), 0, 100),
      age_25_34: clampInt(Number(audienceAge?.["25-34"] ?? 0), 0, 100),
      age_35_44: clampInt(Number(audienceAge?.["35-44"] ?? 0), 0, 100),
      age_45_54: clampInt(Number(audienceAge?.["45-54"] ?? 0), 0, 100),
      age_55_64: clampInt(Number(audienceAge?.["55-64"] ?? 0), 0, 100),

      content_style_one: safeCommaListToArray((profile as any)?.content_style ?? "")?.[0] ?? "",
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOpen]);

  useEffect(() => {
    if (!editOpen) return;

    const uf = normalizeUF(form.state);
    const q = (form.city || "").trim().toLowerCase();

    if (!uf || uf.length !== 2) {
      setCitySuggestions([]);
      return;
    }

    let alive = true;
    const t = setTimeout(async () => {
      try {
        if (!alive) return;

        if (!citiesCacheRef.current[uf]) {
          if (cityFetchAbortRef.current) cityFetchAbortRef.current.abort();
          const ac = new AbortController();
          cityFetchAbortRef.current = ac;

          const list = await fetchCitiesByUF(uf, ac.signal);
          citiesCacheRef.current[uf] = list;
        }

        const list = citiesCacheRef.current[uf] || [];
        const filtered = q.length < 1 ? list.slice(0, 25) : list.filter((name) => name.toLowerCase().startsWith(q)).slice(0, 25);

        if (!alive) return;
        setCitySuggestions(filtered);
      } catch {
        if (!alive) return;
        setCitySuggestions([]);
      }
    }, 220);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [editOpen, form.state, form.city]);

  const followersFormatted = useMemo(() => {
    const digits = parseDigitsOnly(form.followers_digits);
    if (!digits) return "";
    return formatBRInt(Number(digits));
  }, [form.followers_digits]);

  const femaleInput = useMemo(() => parseDigitsOnly(form.female_str).slice(0, 3), [form.female_str]);
  const femaleValue = clamp(Number(femaleInput || 0), 0, 100);

  const genderFromSlider = useMemo(() => clamp(Number(femaleValue), 0, 100), [femaleValue]);

  const saveEditProfile = async () => {
    if (!profile?.id) return;

    if (!form.name.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }

    const uf = normalizeUF(form.state);
    const followersNum = Number(parseDigitsOnly(form.followers_digits) || 0);

    const female = clamp(Number(parseDigitsOnly(form.female_str) || 0), 0, 100);
    const male = clamp(100 - female, 0, 100);

    const ageObj: Record<string, number> = {
      "18-24": clampInt(form.age_18_24, 0, 100),
      "25-34": clampInt(form.age_25_34, 0, 100),
      "35-44": clampInt(form.age_35_44, 0, 100),
      "45-54": clampInt(form.age_45_54, 0, 100),
      "55-64": clampInt(form.age_55_64, 0, 100),
    };

    setSaving(true);
    try {
      const bioSafe = (form.bio || "").slice(0, BIO_LIMIT).trim();

      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          name: form.name.trim(),
          state: uf || null,
          city: form.city.trim() || null,
          neighborhood: form.neighborhood.trim() || null,
          bio: bioSafe ? bioSafe : null,

          instagram: form.instagram_username.trim() || null,
          followers: String(Math.max(0, followersNum)),

          content_style: form.content_style_one?.trim() ? form.content_style_one.trim() : null,

          audience_gender: { female, male },
          audience_age: ageObj,
        })
        .eq("id", profile.id);

      if (pErr) throw pErr;

      await updateMyInstagramStats({
        instagram_username: form.instagram_username,
        followers_count: Math.max(0, followersNum),
        audience_female_pct: female,
        audience_male_pct: male,
        audience_region: undefined,
      });

      toast.success("Perfil atualizado!");
      setEditOpen(false);

      await ctx.refetch();
      await refreshProfile();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  };

  const stateUF = (profile?.state || "").toString();
  const stateName = ufToName(stateUF) || "—";
  const cityLabel = (profile?.city || "—").toString();
  const neighborhoodLabel = ((profile as any)?.neighborhood || "—").toString();

  const stateMapsQuery = stateUF ? `${stateName}, Brasil` : "";
  const cityMapsQuery =
    stateUF && cityLabel && cityLabel !== "—" ? `${cityLabel}, ${stateUF}, Brasil` : cityLabel !== "—" ? `${cityLabel}, Brasil` : "";
  const neighborhoodMapsQuery =
    stateUF && cityLabel && neighborhoodLabel && neighborhoodLabel !== "—"
      ? `${neighborhoodLabel}, ${cityLabel}, ${stateUF}, Brasil`
      : neighborhoodLabel !== "—"
        ? `${neighborhoodLabel}, Brasil`
        : "";

  return (
    <MobileLayout title="Meu perfil" showBack navType="influencer">
      <div className="px-6 py-6 space-y-6">
        {/* HEADER */}
        <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-white/5 shadow-sm">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5" />
            <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:16px_16px]" />
          </div>

          <div className="relative p-5">
            <div className="flex items-start gap-4">
              {/* avatar */}
              <div className="relative shrink-0">
                <div className="absolute -inset-2 rounded-3xl bg-primary/10 blur-lg opacity-60" />
                <div className="relative w-20 h-20 rounded-3xl overflow-hidden border border-primary/20 bg-white/5 flex items-center justify-center">
                  {(profile as any)?.avatar_url ? (
                    <img
                      src={(profile as any).avatar_url}
                      alt="Avatar"
                      className="w-full h-full object-cover block"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-primary font-bold">{initials(profile?.name)}</span>
                  )}
                </div>

                <div className="pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-white/10" />

                <button
                  type="button"
                  onClick={handlePickAvatar}
                  disabled={avatarUploading}
                  className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-primary flex items-center justify-center disabled:opacity-60 shadow-md"
                  title="Alterar foto"
                >
                  {avatarUploading ? <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" /> : <Camera className="w-4 h-4 text-primary-foreground" />}
                </button>

                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarFile(e.target.files?.[0])} />
              </div>

              {/* infos */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-xl font-semibold text-foreground leading-tight break-words">{profile?.name || "Creator"}</h1>
                  {isVerifiedInfluencer ? (
                    <span className="shrink-0">
                      <VerifiedBadge size="sm" />
                    </span>
                  ) : null}
                </div>

                {/* ✅ FIXO: indica tipo do painel */}
                <div className="mt-0.5 text-xs text-muted-foreground">Creator</div>

                <div className="mt-2 text-sm text-foreground/90 leading-relaxed">
                  {headerBio ? (
                    <>
                      <span className="line-clamp-3">{headerBio}</span>
                      {showBioMore ? (
                        <button type="button" onClick={() => setBioOpen(true)} className="mt-1 text-xs text-primary hover:opacity-90 transition">
                          Ver mais
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Adicione uma bio para deixar seu perfil mais completo.</span>
                  )}
                </div>
              </div>
            </div>

            {/* ações */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <IconButton icon={<Pencil className="w-4 h-4" />} label="Editar perfil" onClick={() => setEditOpen(true)} className="w-full justify-center" />
              <IconButton
                icon={<Instagram className="w-4 h-4" />}
                label={igRaw ? `@${igRaw}` : "Instagram"}
                onClick={() => openInstagram(igHandle)}
                disabled={!igRaw}
                className="w-full justify-center"
              />
            </div>
          </div>
        </div>

        {/* MODAL Bio */}
        {bioOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
            <div className="absolute inset-0 bg-black/60" onMouseDown={() => setBioOpen(false)} />
            <div
              className="relative w-full md:max-w-lg rounded-t-3xl md:rounded-3xl border border-border/50 bg-background p-5"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">Bio</div>
                <button className="p-2 rounded-xl hover:bg-white/5" onClick={() => setBioOpen(false)} type="button">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 text-sm text-foreground leading-relaxed whitespace-pre-line">{headerBio}</div>
            </div>
          </div>
        )}

        {/* 3 CHIPS */}
        <div className="grid grid-cols-3 gap-2">
          <MicroChip icon={<Users className="w-4 h-4" />} label="Seguidores" value={followersCompact} title={`Seguidores: ${followersLabel}`} />
          <MicroChip icon={<Sparkles className="w-4 h-4" />} label="Conteúdo" value={primaryStyle} title={`Estilo: ${primaryStyle}`} />
          <MicroChip icon={<MapPin className="w-4 h-4" />} label="Localização" value={cityLabel || "—"} title={`Cidade: ${cityLabel}`} />
        </div>

        {/* AUDIÊNCIA */}
        <SectionShell title="Audiência">
          <DualDonutChart aPct={femalePct} bPct={malePct} label="Gênero" aLabel="Feminino" bLabel="Masculino" />

          <div className="mt-4">
            <AgeBarsCard data={audienceAge} buckets={[...AGE_BARS_BUCKETS]} />
          </div>

          <div className="mt-4">
            <div className="text-xs text-muted-foreground mb-2">Principais localizações</div>

            <div className="grid grid-cols-3 gap-2">
              <LocationInfoChip
                icon={<Map className="w-4 h-4" />}
                label="Estado"
                value={stateUF ? stateUF : "—"}
                title={stateUF ? `Abrir no Maps: ${stateName}` : "Estado não informado"}
                onClick={stateUF ? () => openMapsQuery(stateMapsQuery) : undefined}
              />
              <LocationInfoChip
                icon={<Building2 className="w-4 h-4" />}
                label="Cidade"
                value={cityLabel || "—"}
                title={cityLabel && cityLabel !== "—" ? `Abrir no Maps: ${cityLabel}` : "Cidade não informada"}
                onClick={cityLabel && cityLabel !== "—" ? () => openMapsQuery(cityMapsQuery) : undefined}
              />
              <LocationInfoChip
                icon={<Home className="w-4 h-4" />}
                label="Bairro"
                value={neighborhoodLabel || "—"}
                title={neighborhoodLabel && neighborhoodLabel !== "—" ? `Abrir no Maps: ${neighborhoodLabel}` : "Bairro não informado"}
                onClick={neighborhoodLabel && neighborhoodLabel !== "—" ? () => openMapsQuery(neighborhoodMapsQuery) : undefined}
              />
            </div>
          </div>
        </SectionShell>

        {/* ✅ AVALIAÇÕES */}
        <RatingsCard rating={ratingAvg} count={ratingCount} loading={loadingRatings} />

        {/* ✅ MINHAS CAMPANHAS (minimalista) */}
        <button
          type="button"
          onClick={() => navigate("/historico")}
          className="w-full rounded-2xl bg-gradient-neon text-primary-foreground glow-blue
          px-5 py-4 font-semibold text-base flex items-center justify-between
          active:scale-[0.99] transition"
        >
          <span>Minhas campanhas</span>
          <ChevronRight className="w-5 h-5 opacity-90" />
        </button>

        {/* ATIVAÇÕES E CAMPANHAS */}
        <SingleStatCard title="Ativações e campanhas" label="Realizadas:" value={orbtyAccepted} loading={loadingOrbty} />

        {/* MODAL: Editar perfil */}
        {editOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
            <div className="absolute inset-0 bg-black/60" onMouseDown={() => (saving ? null : setEditOpen(false))} />

            <div
              className="relative w-full md:max-w-lg rounded-t-3xl md:rounded-3xl border border-border/50 bg-background p-5"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-foreground">Editar perfil</div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate("/perfil-influenciadora/dados-pessoais")}
                    className="text-xs px-3 py-2 rounded-xl border border-border/50 bg-white/5 hover:bg-white/10 transition text-muted-foreground hover:text-foreground inline-flex items-center gap-2"
                    title="Abrir dados pessoais"
                  >
                    <Shield className="w-4 h-4" />
                    Dados pessoais
                  </button>

                  <button className="p-2 rounded-xl hover:bg-white/5" onClick={() => (saving ? null : setEditOpen(false))} type="button">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-5 max-h-[70vh] overflow-auto pr-1">
                {/* Informações */}
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-widest">Informações</div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Nome *</Label>
                    <Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} className="text-sm" />
                  </div>

                  {/* Estado / Cidade / Bairro (3 campos alinhados) */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Estado (UF)</Label>
                      <Input
                        value={form.state}
                        onChange={(e) => {
                          const uf = normalizeUF(e.target.value);
                          setForm((s) => ({ ...s, state: uf }));
                        }}
                        placeholder="SP"
                        className="text-sm uppercase"
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

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Cidade</Label>
                      <Input
                        value={form.city}
                        onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
                        placeholder="Digite a cidade"
                        className="text-sm"
                        list="city-list"
                        autoComplete="off"
                      />
                      <datalist id="city-list">
                        {citySuggestions.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Bairro</Label>
                      <Input
                        value={form.neighborhood}
                        onChange={(e) => setForm((s) => ({ ...s, neighborhood: e.target.value }))}
                        placeholder="Digite o bairro"
                        className="text-sm"
                      />
                    </div>
                  </div>

                  {/* ✅ BIO com limite */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Bio</Label>
                    <Input
                      value={form.bio}
                      maxLength={BIO_LIMIT}
                      onChange={(e) => {
                        const v = String(e.target.value || "").slice(0, BIO_LIMIT);
                        setForm((s) => ({ ...s, bio: v }));
                      }}
                      className="text-sm"
                    />
                    <div className="text-[11px] text-muted-foreground">Há um limite para a bio. Use uma frase curta.</div>
                  </div>
                </div>

                {/* Instagram */}
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-widest">Instagram</div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">@instagram</Label>
                    <Input
                      value={form.instagram_username}
                      onChange={(e) => setForm((s) => ({ ...s, instagram_username: e.target.value }))}
                      placeholder="@seuinstagram"
                      className="text-sm"
                    />
                  </div>

                  {/* Seguidores */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Seguidores</Label>
                    <Input
                      value={followersFormatted}
                      onChange={(e) => {
                        const digits = parseDigitsOnly(e.target.value).slice(0, 12);
                        setForm((s) => ({ ...s, followers_digits: digits }));
                      }}
                      placeholder="0"
                      className="text-sm"
                      inputMode="numeric"
                      autoComplete="off"
                    />
                    <div className="text-[11px] text-muted-foreground">Digite apenas números (o campo formata automaticamente).</div>
                  </div>
                </div>

                {/* Estilo de conteúdo */}
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-widest">Estilo de conteúdo</div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      "Lifestyle",
                      "Beleza",
                      "Moda",
                      "Educação",
                      "Fitness",
                      "Gastronomia",
                      "Viagem",
                      "Tech",
                      "Games",
                      "Maternidade",
                      "Negócios",
                      "Humor",
                      "Música",
                    ].map((opt) => {
                      const active = form.content_style_one === opt;

                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() =>
                            setForm((s) => ({
                              ...s,
                              content_style_one: active ? "" : opt,
                            }))
                          }
                          className={`text-xs px-3 py-2 rounded-full border transition ${
                            active
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-border/50 bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  <div className="text-[11px] text-muted-foreground">
                    Selecionado: <span className="text-foreground font-medium">{form.content_style_one || "—"}</span>
                  </div>
                </div>

                {/* Audiência */}
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-widest">Audiência</div>
                  <div className="text-[11px] text-muted-foreground">Preencha com base nos dados do seu público do Instagram</div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Feminino (%)</Label>
                      <div className="relative">
                        <Input
                          value={form.female_str}
                          onChange={(e) => {
                            const digits = parseDigitsOnly(e.target.value).slice(0, 3);
                            const val = digits ? clamp(Number(digits), 0, 100) : 0;
                            const male = clamp(100 - val, 0, 100);
                            setForm((s) => ({ ...s, female_str: digits ? String(val) : "", male_str: String(male) }));
                          }}
                          placeholder="0"
                          className="text-sm pr-7"
                          inputMode="numeric"
                          autoComplete="off"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Masculino (%)</Label>
                      <div className="relative">
                        <Input
                          value={form.male_str}
                          onChange={(e) => {
                            const digits = parseDigitsOnly(e.target.value).slice(0, 3);
                            const val = digits ? clamp(Number(digits), 0, 100) : 0;
                            const female = clamp(100 - val, 0, 100);
                            setForm((s) => ({ ...s, male_str: digits ? String(val) : "", female_str: String(female) }));
                          }}
                          placeholder="0"
                          className="text-sm pr-7"
                          inputMode="numeric"
                          autoComplete="off"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Ajuste rápido (Feminino)</Label>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Feminino: {clamp(Number(parseDigitsOnly(form.female_str) || 0), 0, 100)}%</span>
                      <span>Masculino: {clamp(100 - clamp(Number(parseDigitsOnly(form.female_str) || 0), 0, 100), 0, 100)}%</span>
                    </div>
                    <Slider
                      value={[genderFromSlider]}
                      onValueChange={(v) => {
                        const female = clamp(v[0], 0, 100);
                        const male = clamp(100 - female, 0, 100);
                        setForm((s) => ({ ...s, female_str: String(female), male_str: String(male) }));
                      }}
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-white/5 p-4">
                    <div className="text-xs text-muted-foreground mb-3">Faixa etária</div>

                    {(
                      [
                        { key: "18-24", val: form.age_18_24, set: (x: number) => setForm((s) => ({ ...s, age_18_24: x })) },
                        { key: "25-34", val: form.age_25_34, set: (x: number) => setForm((s) => ({ ...s, age_25_34: x })) },
                        { key: "35-44", val: form.age_35_44, set: (x: number) => setForm((s) => ({ ...s, age_35_44: x })) },
                        { key: "45-54", val: form.age_45_54, set: (x: number) => setForm((s) => ({ ...s, age_45_54: x })) },
                        { key: "55-64", val: form.age_55_64, set: (x: number) => setForm((s) => ({ ...s, age_55_64: x })) },
                      ] as const
                    ).map((row) => (
                      <div key={row.key} className="py-2">
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-muted-foreground">{row.key}</span>
                          <span className="text-foreground font-medium">{clampInt(row.val, 0, 100)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-2">
                          <div className="h-full bg-white/30" style={{ width: `${clampInt(row.val, 0, 100)}%` }} />
                        </div>
                        <Slider value={[clampInt(row.val, 0, 100)]} onValueChange={(v) => row.set(clampInt(v[0], 0, 100))} min={0} max={100} step={10} />
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={saveEditProfile}
                  disabled={saving}
                  className="w-full py-3 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-sm glow-blue flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
            </div>
          </div>
        )}

        {ctx.error && <div className="text-xs text-muted-foreground">Erro ao carregar contexto premium: {String(ctx.error)}</div>}
      </div>
    </MobileLayout>
  );
}