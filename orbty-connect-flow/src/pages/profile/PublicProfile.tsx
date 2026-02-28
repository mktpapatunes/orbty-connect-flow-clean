import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import VerifiedBadge from "@/components/VerifiedBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  ArrowLeft,
  Instagram,
  Loader2,
  MapPin,
  Users,
  Sparkles,
  ExternalLink,
  BarChart3,
  Building2,
  Package,
  Globe,
  Home as HomeIcon,
  Map as MapIcon,
  ArrowUpRight,
} from "lucide-react";

/* =========================
   Types
========================= */

type AudienceGender = { female?: number; male?: number };
type AudienceAgeKey = "18-24" | "25-34" | "35-44" | "45-54" | "55-64" | "65+";
type AudienceAge = Partial<Record<AudienceAgeKey, number>>;
type AudienceCityRow = { city: string; pct: number };

type ProfileRow = {
  id: string;
  name: string;
  city: string;
  state: string;
  neighborhood: string | null;
  bio: string | null;
  avatar_url: string | null;

  instagram: string | null;
  followers: string | null;
  content_style: string | null;

  audience_gender: AudienceGender | null;
  audience_age: AudienceAge | null;
  audience_cities: AudienceCityRow[] | null;

  // opcional
  approval_status?: string | null;
  role?: string | null;
  user_role?: string | null;
};

type OrganizationRow = {
  id: string;
  name: string;
  region_city: string | null;
  region_state: string | null;
  bio: string | null;
  logo_url: string | null;
  instagram: string | null;
  website_url: string | null;
  business_category: string | null;
  product_or_brand: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_zip: string | null;
};

type RatingSummary = { avg: number; count: number };

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

/* =========================
   Helpers
========================= */

function safeUrl(url?: string | null) {
  const raw = (url || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

const normalizeInstagram = (v?: string | null) => {
  const raw = (v || "").trim();
  if (!raw) return null;
  return raw.startsWith("@") ? raw.slice(1) : raw;
};

const initials = (name?: string | null) => {
  const n = (name || "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const normalizeStyles = (raw?: string | null) =>
  (raw || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 3);

function SkeletonLine({ w = "100%", h = 12 }: { w?: string; h?: number }) {
  return <div className="animate-pulse rounded-xl bg-white/10" style={{ width: w, height: h }} />;
}

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
            className={`text-[22px] leading-none select-none ${filled ? "text-yellow-400" : "text-white/20"}`}
            aria-hidden="true"
          >
            ★
          </span>
        );
      })}
    </div>
  );
}

function RatingsCard(props: { rating: number; count?: number | null; loading?: boolean; title?: string }) {
  if (props.loading) {
    return (
      <div className="glass-card p-5 shadow-sm transition hover:shadow-md hover:bg-white/[0.06]">
        <div className="text-sm font-semibold text-foreground text-center">{props.title ?? "Avaliações"}</div>
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
      <div className="text-sm font-semibold text-foreground text-center">{props.title ?? "Avaliações"}</div>

      <div className="mt-3">
        <StarRating value={safeRating} />
      </div>

      <div className="mt-2 text-center text-xs text-muted-foreground">
        {count && count > 0 ? `${safeRating.toFixed(1).replace(".", ",")} · ${count} avaliações` : "Sem avaliações ainda"}
      </div>
    </div>
  );
}

/* =========================
   UI blocks
========================= */

function MicroChip(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
  title?: string;
  onClick?: () => void;
  clickable?: boolean;
}) {
  const clickable = !!props.onClick || !!props.clickable;

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={!clickable}
      title={props.title}
      className={`h-12 min-w-0 flex items-center gap-2 rounded-2xl border border-border/50 bg-white/5 px-3
      text-[11px] text-foreground/90 shadow-sm text-left
      ${clickable ? "hover:bg-white/10 hover:shadow-sm active:scale-[0.99]" : "opacity-100"}
      disabled:opacity-100 disabled:cursor-default`}
    >
      <span className="shrink-0 text-primary">{props.icon}</span>
      <div className="min-w-0 leading-tight">
        <div className="text-[10px] text-muted-foreground whitespace-nowrap">{props.label}:</div>
        <div className="text-xs font-semibold truncate whitespace-nowrap">{props.value}</div>
      </div>
      {clickable ? (
        <span className="ml-auto text-muted-foreground">
          <ArrowUpRight className="w-4 h-4" />
        </span>
      ) : null}
    </button>
  );
}

function Donut(props: { pct: number; label: string; sub?: string; ringColor?: string }) {
  const pct = clamp(props.pct, 0, 100);
  const size = 92;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-4 flex items-center gap-4">
      <svg width={size} height={size} className="shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={props.ringColor ?? "rgba(59,130,246,0.85)"}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="16" fontWeight="700">
          {pct.toFixed(0)}%
        </text>
      </svg>

      <div className="min-w-0">
        <div className="text-sm font-semibold text-foreground">{props.label}</div>
        {props.sub ? <div className="text-xs text-muted-foreground mt-1">{props.sub}</div> : null}
      </div>
    </div>
  );
}

/* =========================
   Data fetch helpers (flex)
========================= */

function isMissingColumnError(msg: string) {
  const m = (msg || "").toLowerCase();
  return m.includes("does not exist") || m.includes("column") || m.includes("42703");
}

async function selectProfileById(id: string) {
  // tenta com approval_status + role
  const selectFull =
    "id, name, city, state, neighborhood, bio, avatar_url, instagram, followers, content_style, audience_gender, audience_age, audience_cities, approval_status, role, user_role";
  const selectSafe =
    "id, name, city, state, neighborhood, bio, avatar_url, instagram, followers, content_style, audience_gender, audience_age, audience_cities";

  const first = await supabase.from("profiles").select(selectFull).eq("id", id).maybeSingle();

  if (first.error) {
    if (!isMissingColumnError(first.error.message || "")) throw first.error;

    const second = await supabase.from("profiles").select(selectSafe).eq("id", id).maybeSingle();
    if (second.error) throw second.error;
    return second.data as any;
  }

  return first.data as any;
}

async function selectOrganizationByOwnerProfileIdFlexible(profileId: string) {
  // A gente tenta várias FKs comuns, porque o schema pode variar.
  // Em cada tentativa: se a coluna não existir, tenta a próxima.
  const selectOrg =
    "id, name, region_city, region_state, bio, logo_url, instagram, website_url, business_category, product_or_brand, address_street, address_number, address_complement, address_zip";

  const attempts: Array<{ col: string }> = [{ col: "owner_profile_id" }, { col: "profile_id" }, { col: "user_id" }];

  for (const a of attempts) {
    const res = await supabase.from("organizations").select(selectOrg).eq(a.col as any, profileId).maybeSingle();

    if (res.error) {
      if (isMissingColumnError(res.error.message || "")) continue;
      throw res.error;
    }
    if (res.data) return res.data as any;
  }

  return null;
}

async function selectInfluencerRating(profileId: string) {
  // view: influencer_rating_summary (influencer_id, avg_rating, rating_count)
  const { data, error } = await supabase
    .from("influencer_rating_summary")
    .select("avg_rating, rating_count")
    .eq("influencer_id", profileId)
    .maybeSingle();

  if (error) throw error;

  const avg = Number((data as any)?.avg_rating ?? 0);
  const cnt = Number((data as any)?.rating_count ?? 0);
  return { avg: Number.isFinite(avg) ? avg : 0, count: Number.isFinite(cnt) ? cnt : 0 } satisfies RatingSummary;
}

async function selectOrganizationRating(orgId: string) {
  // view: organization_rating_summary (organization_id, avg_rating, rating_count)
  const { data, error } = await supabase
    .from("organization_rating_summary")
    .select("avg_rating, rating_count")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (error) throw error;

  const avg = Number((data as any)?.avg_rating ?? 0);
  const cnt = Number((data as any)?.rating_count ?? 0);
  return { avg: Number.isFinite(avg) ? avg : 0, count: Number.isFinite(cnt) ? cnt : 0 } satisfies RatingSummary;
}

/* =========================
   Page
========================= */

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, userRole } = useAuth();

  const isSelf = !!user?.id && !!id && user.id === id;

  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [org, setOrg] = useState<OrganizationRow | null>(null);

  const [role, setRole] = useState<"influencer" | "contractor" | null>(null);

  const [rating, setRating] = useState<RatingSummary>({ avg: 0, count: 0 });
  const [loadingRating, setLoadingRating] = useState<boolean>(true);

  const backTo = userRole === "contractor" ? "/dashboard-contratante" : "/dashboard-influenciadora";

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!id) {
        setLoading(false);
        setProfile(null);
        setOrg(null);
        setRole(null);
        return;
      }

      setLoading(true);
      setLoadingRating(true);

      try {
        const data = await selectProfileById(id);

        if (!mounted) return;

        if (!data) {
          setProfile(null);
          setOrg(null);
          setRole(null);
          setLoading(false);
          setLoadingRating(false);
          return;
        }

        // normalize cities array
        const cities: AudienceCityRow[] | null = Array.isArray((data as any).audience_cities)
          ? (data as any).audience_cities
              .map((r: any) => ({ city: String(r?.city ?? "").trim(), pct: clamp(Number(r?.pct ?? 0), 0, 100) }))
              .filter((r: any) => r.city)
              .slice(0, 6)
          : null;

        const p: ProfileRow = {
          ...(data as any),
          audience_cities: cities,
        };

        setProfile(p);

        const inferredRoleRaw = String((p.role ?? p.user_role ?? "")).toLowerCase();
        const inferredRole: "influencer" | "contractor" | null =
          inferredRoleRaw === "contractor" ? "contractor" : inferredRoleRaw === "influencer" ? "influencer" : null;

        // fallback: se não veio role, assume influencer (compat com seu PublicProfile atual)
        const finalRole = inferredRole ?? "influencer";
        setRole(finalRole);

        // se contractor, buscar organização
        if (finalRole === "contractor") {
          const o = await selectOrganizationByOwnerProfileIdFlexible(p.id);
          if (!mounted) return;
          setOrg(o);
        } else {
          setOrg(null);
        }

        setLoading(false);

        // ratings (reais)
        try {
          if (finalRole === "contractor") {
            if (org?.id) {
              const r = await selectOrganizationRating(org.id);
              if (!mounted) return;
              setRating(r);
            } else {
              // se org ainda não carregou (race), tenta buscar org agora e pegar rating
              const o = await selectOrganizationByOwnerProfileIdFlexible(p.id);
              if (!mounted) return;
              setOrg(o);
              if (o?.id) {
                const r = await selectOrganizationRating(o.id);
                if (!mounted) return;
                setRating(r);
              } else {
                setRating({ avg: 0, count: 0 });
              }
            }
          } else {
            const r = await selectInfluencerRating(p.id);
            if (!mounted) return;
            setRating(r);
          }
        } catch (e: any) {
          // rating é “nice to have” — não derruba a página
          console.warn("PUBLIC_PROFILE_RATING_ERROR", e?.message || e);
          if (mounted) setRating({ avg: 0, count: 0 });
        } finally {
          if (mounted) setLoadingRating(false);
        }
      } catch (e: any) {
        console.error("PUBLIC_PROFILE_FETCH_ERROR", e);
        if (mounted) {
          setProfile(null);
          setOrg(null);
          setRole(null);
          setLoading(false);
          setLoadingRating(false);
        }
      }
    };

    run();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isVerifiedOrbty = useMemo(() => {
    const s = String((profile as any)?.approval_status ?? "").toLowerCase();
    return s === "approved";
  }, [profile]);

  const igHandle = useMemo(() => normalizeInstagram(role === "contractor" ? org?.instagram : profile?.instagram), [role, org?.instagram, profile?.instagram]);

  const openInstagram = () => {
    if (!igHandle) return;
    window.open(`https://www.instagram.com/${igHandle}`, "_blank", "noopener,noreferrer");
  };

  const website = useMemo(() => safeUrl(org?.website_url), [org?.website_url]);
  const openWebsite = () => {
    if (!website) return;
    window.open(website, "_blank", "noopener,noreferrer");
  };

  const followersLabel = useMemo(() => {
    const raw = String(profile?.followers ?? "").trim();
    if (!raw) return "—";
    const n = Number(raw.replace(/[^\d]/g, ""));
    return Number.isFinite(n) && n > 0 ? n.toLocaleString("pt-BR") : raw;
  }, [profile?.followers]);

  const styles = useMemo(() => normalizeStyles(profile?.content_style ?? null), [profile?.content_style]);

  const influencerLocationLabel = useMemo(() => {
    if (!profile) return "—";
    const base = `${profile.city}, ${profile.state}`;
    if (profile.neighborhood) return `${profile.neighborhood} · ${base}`;
    return base;
  }, [profile]);

  const contractorLocationLabel = useMemo(() => {
    const city = org?.region_city || profile?.city;
    const state = org?.region_state || profile?.state;
    if (city && state) return `${city}, ${state}`;
    if (city) return city;
    return "—";
  }, [org?.region_city, org?.region_state, profile?.city, profile?.state]);

  const openMaps = () => {
    // para contractor: tenta o endereço, mas se não tiver, abre cidade/estado
    const parts =
      role === "contractor"
        ? [
            org?.address_street,
            org?.address_number,
            org?.address_complement,
            org?.address_zip,
            org?.region_city || profile?.city,
            org?.region_state || profile?.state,
          ]
        : [profile?.neighborhood, profile?.city, profile?.state];

    const q = encodeURIComponent(
      parts
        .map((x: any) => (x || "").toString().trim())
        .filter(Boolean)
        .join(", ")
    );

    if (!q) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener,noreferrer");
  };

  const audienceGender = useMemo(() => {
    const g = profile?.audience_gender;
    if (!g) return null;
    const female = typeof g.female === "number" ? clamp(g.female, 0, 100) : null;
    const male = typeof g.male === "number" ? clamp(g.male, 0, 100) : null;
    if (female === null && male === null) return null;

    if (female !== null && male === null) return { female, male: 100 - female };
    if (male !== null && female === null) return { male, female: 100 - male };
    return { female: female!, male: male! };
  }, [profile?.audience_gender]);

  const topAge = useMemo(() => {
    const a = profile?.audience_age;
    if (!a || typeof a !== "object") return null;

    const entries = Object.entries(a as any)
      .map(([k, v]) => ({ k, v: clamp(Number(v || 0), 0, 100) }))
      .filter((x) => x.v > 0)
      .sort((x, y) => y.v - x.v);

    if (!entries.length) return null;
    return entries.slice(0, 5);
  }, [profile?.audience_age]);

  const topCities = useMemo(() => {
    const c = profile?.audience_cities;
    if (!Array.isArray(c) || !c.length) return null;
    return c.slice(0, 6);
  }, [profile?.audience_cities]);

  // bio “ver mais”
  const [bioOpen, setBioOpen] = useState(false);
  const headerBio = useMemo(() => (role === "contractor" ? (org?.bio || "").trim() : (profile?.bio || "").trim()), [role, org?.bio, profile?.bio]);
  const showBioMore = useMemo(() => headerBio.length > 140, [headerBio]);

  return (
    <MobileLayout
      title="Perfil"
      showBack
      backTo={backTo}
      navType={userRole === "contractor" ? "contractor" : "influencer"}
      showNav={false}
      showHome={false}
    >
      <div className="px-6 py-6 space-y-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : !profile ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Perfil não encontrado.</p>
          </div>
        ) : (
          <>
            {/* HEADER PREMIUM (influencer/contractor) */}
            <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-white/5 shadow-sm">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5" />
                <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:16px_16px]" />
              </div>

              <div className="relative p-5">
                <div className="flex items-start gap-4">
                  {/* Avatar/Logo */}
                  <div className="relative shrink-0">
                    <div className="absolute -inset-2 rounded-3xl bg-primary/10 blur-lg opacity-60" />
                    <div className="relative w-20 h-20 rounded-3xl overflow-hidden border border-primary/20 bg-white/5 flex items-center justify-center">
                      {role === "contractor" ? (
                        org?.logo_url ? (
                          <img
                            src={org.logo_url}
                            alt={org?.name || "Logo"}
                            className="w-full h-full object-cover block"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-primary font-bold">{initials(org?.name || profile.name)}</span>
                        )
                      ) : profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.name}
                          className="w-full h-full object-cover block"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-primary font-bold">{initials(profile.name)}</span>
                      )}
                    </div>
                    <div className="pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-white/10" />
                  </div>

                  {/* Infos */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <h1 className="text-xl font-semibold text-foreground leading-tight break-words">
                        {role === "contractor" ? org?.name || profile.name : profile.name}
                      </h1>
                      {isVerifiedOrbty ? <VerifiedBadge size="sm" /> : null}
                    </div>

                    <div className="mt-2 text-sm text-foreground/90 leading-relaxed">
                      {headerBio ? (
                        <>
                          <span className="line-clamp-3">{headerBio}</span>
                          {showBioMore ? (
                            <button
                              type="button"
                              onClick={() => setBioOpen(true)}
                              className="mt-1 text-xs text-primary hover:opacity-90 transition"
                            >
                              Ver mais
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Sem descrição.</span>
                      )}
                    </div>

                    <div className="mt-3 text-xs text-muted-foreground inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate">{role === "contractor" ? contractorLocationLabel : influencerLocationLabel}</span>
                    </div>
                  </div>
                </div>

                {/* ações públicas (instagram / site) */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={openInstagram}
                    disabled={!igHandle}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl border border-border/50 bg-white/5 px-3 py-2 text-sm text-foreground transition
                    hover:bg-white/10 hover:shadow-sm active:scale-[0.99]
                    disabled:opacity-60 disabled:hover:bg-white/5`}
                    title={igHandle ? `@${igHandle}` : "Sem Instagram"}
                  >
                    <Instagram className="w-4 h-4 text-primary" />
                    {igHandle ? `@${igHandle}` : "Instagram"}
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </button>

                  <button
                    type="button"
                    onClick={role === "contractor" ? openWebsite : openMaps}
                    disabled={role === "contractor" ? !website : false}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl border border-border/50 bg-white/5 px-3 py-2 text-sm text-foreground transition
                    hover:bg-white/10 hover:shadow-sm active:scale-[0.99]
                    disabled:opacity-60 disabled:hover:bg-white/5`}
                    title={role === "contractor" ? (website ? "Abrir site" : "Sem site") : "Abrir no Google Maps"}
                  >
                    {role === "contractor" ? <Globe className="w-4 h-4 text-primary" /> : <MapPin className="w-4 h-4 text-primary" />}
                    {role === "contractor" ? "Site" : "Maps"}
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {isSelf ? (
                  <div className="mt-3 text-[11px] text-muted-foreground">
                    Você está visualizando seu próprio perfil público.
                  </div>
                ) : null}
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
                    <div className="text-sm font-semibold text-foreground">Sobre</div>
                    <button className="p-2 rounded-xl hover:bg-white/5" onClick={() => setBioOpen(false)} type="button">
                      ✕
                    </button>
                  </div>
                  <div className="mt-3 text-sm text-foreground leading-relaxed whitespace-pre-line">{headerBio}</div>
                </div>
              </div>
            )}

            {/* CHIPS (refletem o tipo) */}
            {role === "contractor" ? (
              <div className="grid grid-cols-3 gap-2">
                <MicroChip
                  icon={<MapPin className="w-4 h-4" />}
                  label="Localização"
                  value={contractorLocationLabel}
                  title="Abrir no Google Maps"
                  onClick={openMaps}
                  clickable
                />
                <MicroChip icon={<Building2 className="w-4 h-4" />} label="Categoria" value={(org?.business_category || "—").trim() || "—"} />
                <MicroChip icon={<Package className="w-4 h-4" />} label="Produto" value={(org?.product_or_brand || "—").trim() || "—"} />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <MicroChip
                  icon={<Users className="w-4 h-4" />}
                  label="Seguidores"
                  value={followersLabel}
                  title="Seguidores"
                />
                <MicroChip
                  icon={<Sparkles className="w-4 h-4" />}
                  label="Conteúdo"
                  value={styles.length ? styles[0] : "—"}
                  title={styles.length ? styles.join(", ") : "—"}
                />
                <MicroChip
                  icon={<MapPin className="w-4 h-4" />}
                  label="Localização"
                  value={influencerLocationLabel || "—"}
                  title="Abrir no Google Maps"
                  onClick={openMaps}
                  clickable
                />
              </div>
            )}

            {/* AVALIAÇÕES (reais) */}
            <RatingsCard rating={rating.avg} count={rating.count} loading={loadingRating} title="Avaliações" />

            {/* AUDIÊNCIA (apenas influencer) */}
            {role === "influencer" ? (
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Audiência</p>
                </div>

                {!audienceGender && !topAge && !topCities ? (
                  <p className="text-sm text-muted-foreground">Sem dados de audiência por enquanto.</p>
                ) : (
                  <div className="space-y-3">
                    {audienceGender && (
                      <div className="grid grid-cols-1 gap-3">
                        <Donut pct={audienceGender.female ?? 0} label="Feminino" sub="Distribuição por gênero" ringColor="rgba(236,72,153,0.85)" />
                        <Donut pct={audienceGender.male ?? 0} label="Masculino" sub="Distribuição por gênero" ringColor="rgba(59,130,246,0.85)" />
                      </div>
                    )}

                    {topAge && (
                      <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                        <div className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Faixa etária</div>
                        <div className="space-y-2">
                          {topAge.map((x) => (
                            <div key={x.k} className="flex items-center justify-between text-sm">
                              <span className="text-foreground font-medium">{x.k}</span>
                              <span className="text-muted-foreground">{Number(x.v ?? 0).toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {topCities && (
                      <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                        <div className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Principais cidades</div>
                        <div className="flex flex-wrap gap-2">
                          {topCities.map((r, idx) => (
                            <span
                              key={`${r.city}-${idx}`}
                              className="text-xs px-3 py-1.5 rounded-full border border-border/50 bg-white/5 text-muted-foreground"
                            >
                              {r.city} · {Number(r.pct ?? 0).toFixed(0)}%
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            {/* Se contractor sem org cadastrada */}
            {role === "contractor" && !org ? (
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Building2 className="w-4 h-4 text-primary" />
                  Perfil de negócio
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Este usuário ainda não cadastrou um negócio completo.
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </MobileLayout>
  );
}