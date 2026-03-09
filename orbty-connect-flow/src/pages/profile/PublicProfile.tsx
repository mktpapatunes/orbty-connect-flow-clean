import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
  Map as MapIcon,
  Building2,
  Home,
  Globe,
  Package,
  Star,
  X,
} from "lucide-react";

/* =========================
   Helpers
========================= */

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
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
        //
      }
    }, 450);
  }
}

function openMapsQuery(query: string) {
  const q = encodeURIComponent((query || "").trim());
  if (!q) return;
  window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener,noreferrer");
}

function safeUrl(url?: string | null) {
  const raw = (url || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function isMissingColumnError(msg: string) {
  const m = (msg || "").toLowerCase();
  return m.includes("does not exist") || m.includes("column") || m.includes("42703");
}

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

/* =========================
   UI blocks
========================= */

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
      <ExternalLink className="w-4 h-4 text-muted-foreground ml-auto" />
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

function DualDonutChart(props: { aPct: number; bPct: number; label: string; aLabel: string; bLabel: string }) {
  const a = clamp(props.aPct, 0, 100);
  const b = clamp(props.bPct, 0, 100);

  const size = 108;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const aDash = (a / 100) * c;
  const bDash = (b / 100) * c;

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
              strokeDashoffset={-aDash}
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
   Types
========================= */

type ProfileRow = {
  id: string;
  name: string | null;
  state: string | null;
  city: string | null;
  neighborhood: string | null;
  bio: string | null;
  avatar_url: string | null;
  instagram: string | null;
  followers: string | null;
  content_style: string | null;
  audience_gender: any | null;
  audience_age: any | null;
  approval_status?: string | null;
  desired_role?: string | null;
};

type OrgRow = {
  id: string;
  created_by?: string | null;
  name: string | null;
  region_city: string | null;
  region_state: string | null;
  business_category: string | null;
  product_or_brand: string | null;
  bio: string | null;
  logo_url: string | null;
  instagram: string | null;
  website_url: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_zip: string | null;
};

type PublicContractorProfileRow = {
  profile_id: string | null;
  profile_name: string | null;
  approval_status: string | null;
  organization_id: string | null;
  organization_name: string | null;
  region_city: string | null;
  region_state: string | null;
  business_category: string | null;
  product_or_brand: string | null;
  bio: string | null;
  logo_url: string | null;
  instagram: string | null;
  website_url: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_zip: string | null;
};

type ReviewableBusinessCampaignRow = {
  campaign_id: string | null;
  title?: string | null;
};

/* =========================
   Fetchers
========================= */

async function fetchProfileById(id: string): Promise<ProfileRow | null> {
  const selectFull =
    "id, name, state, city, neighborhood, bio, avatar_url, instagram, followers, content_style, audience_gender, audience_age, approval_status, desired_role";
  const selectSafe =
    "id, name, state, city, neighborhood, bio, avatar_url, instagram, followers, content_style, audience_gender, audience_age";

  const first = await supabase.from("profiles").select(selectFull).eq("id", id).maybeSingle();

  if (first.error) {
    if (!isMissingColumnError(first.error.message || "")) throw first.error;

    const second = await supabase.from("profiles").select(selectSafe).eq("id", id).maybeSingle();
    if (second.error) throw second.error;
    return (second.data as any) ?? null;
  }

  return (first.data as any) ?? null;
}

async function fetchPublicContractorProfile(profileId: string): Promise<PublicContractorProfileRow | null> {
  const { data, error } = await supabase.rpc("get_public_contractor_profile", {
    p_profile_id: profileId,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return (row as PublicContractorProfileRow) ?? null;
}

async function fetchInfluencerRating(profileId: string) {
  const { data, error } = await supabase
    .from("influencer_rating_summary")
    .select("avg_rating, rating_count")
    .eq("influencer_id", profileId)
    .maybeSingle();

  if (error) throw error;

  const avg = Number((data as any)?.avg_rating ?? 0);
  const cnt = Number((data as any)?.rating_count ?? 0);
  return { avg: Number.isFinite(avg) ? avg : 0, count: Number.isFinite(cnt) ? cnt : 0 };
}

async function fetchOrgRating(orgId: string) {
  const { data, error } = await supabase
    .from("organization_rating_summary")
    .select("avg_rating, rating_count")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (error) throw error;

  const avg = Number((data as any)?.avg_rating ?? 0);
  const cnt = Number((data as any)?.rating_count ?? 0);
  return { avg: Number.isFinite(avg) ? avg : 0, count: Number.isFinite(cnt) ? cnt : 0 };
}

async function fetchInfluencerAcceptedCount(profileId: string) {
  const res: any = await supabase
    .from("campaign_applications")
    .select("id", { count: "exact", head: true })
    .eq("influencer_id", profileId)
    .eq("status", "accepted");

  const cnt = Number(res?.count ?? 0);
  return Number.isFinite(cnt) ? cnt : 0;
}

/* =========================
   Page
========================= */

const AGE_BARS_BUCKETS = ["18-24", "25-34", "35-44", "45-54", "55-64"] as const;

type PublicProfileProps = {
  idOverride?: string;
  embed?: boolean;
  onBack?: () => void;
};

export default function PublicProfile({ idOverride, embed = false, onBack }: PublicProfileProps) {
  const params = useParams<{ id: string }>();
  const id = idOverride ?? params.id;
  const navigate = useNavigate();
  const { user, userRole } = useAuth();

  const [searchParams] = useSearchParams();
  const isEmbed = embed || searchParams.get("embed") === "1";

  const backTo = userRole === "contractor" ? "/dashboard-contratante" : "/dashboard-influenciadora";

  const [loading, setLoading] = useState(true);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [org, setOrg] = useState<OrgRow | null>(null);
  const [role, setRole] = useState<"influencer" | "contractor">("influencer");

  const [ratingAvg, setRatingAvg] = useState(0);
  const [ratingCount, setRatingCount] = useState<number | null>(null);
  const [loadingRatings, setLoadingRatings] = useState(true);

  const [acceptedCount, setAcceptedCount] = useState(0);
  const [loadingAccepted, setLoadingAccepted] = useState(true);

  const [reviewableCampaignId, setReviewableCampaignId] = useState<string | null>(null);
  const [reviewableCampaignTitle, setReviewableCampaignTitle] = useState<string | null>(null);
  const [checkingReviewable, setCheckingReviewable] = useState(false);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useLayoutEffect(() => {
    setLoadedId(null);
    setLoading(true);

    setProfile(null);
    setOrg(null);
    setRole("influencer");

    setRatingAvg(0);
    setRatingCount(null);
    setLoadingRatings(true);

    setAcceptedCount(0);
    setLoadingAccepted(true);

    setReviewableCampaignId(null);
    setReviewableCampaignTitle(null);
    setCheckingReviewable(false);
    setReviewOpen(false);
    setReviewRating(0);
    setReviewComment("");
    setReviewSubmitting(false);
  }, [id]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!id) {
        if (!alive) return;
        setLoading(false);
        setLoadedId(null);
        setProfile(null);
        setOrg(null);
        setLoadingRatings(false);
        setLoadingAccepted(false);
        return;
      }

      try {
        const p = await fetchProfileById(id);
        if (!alive) return;

        if (!p) {
          setProfile(null);
          setOrg(null);
          setLoading(false);
          setLoadingRatings(false);
          setLoadingAccepted(false);
          setLoadedId(id);
          return;
        }

        let contractorRpc: PublicContractorProfileRow | null = null;

        try {
          contractorRpc = await fetchPublicContractorProfile(p.id);
        } catch (rpcError) {
          console.error("PUBLIC_CONTRACTOR_PROFILE_RPC_ERROR", rpcError);
        }

        const hasOrg = !!contractorRpc?.organization_id;
        const finalRole: "influencer" | "contractor" = hasOrg ? "contractor" : "influencer";

        setProfile({
          ...p,
          approval_status: contractorRpc?.approval_status ?? p.approval_status ?? null,
        });

        setRole(finalRole);

        if (finalRole === "contractor" && contractorRpc) {
          setOrg({
            id: contractorRpc.organization_id || "",
            created_by: contractorRpc.profile_id,
            name: contractorRpc.organization_name,
            region_city: contractorRpc.region_city,
            region_state: contractorRpc.region_state,
            business_category: contractorRpc.business_category,
            product_or_brand: contractorRpc.product_or_brand,
            bio: contractorRpc.bio,
            logo_url: contractorRpc.logo_url,
            instagram: contractorRpc.instagram,
            website_url: contractorRpc.website_url,
            address_street: contractorRpc.address_street,
            address_number: contractorRpc.address_number,
            address_complement: contractorRpc.address_complement,
            address_zip: contractorRpc.address_zip,
          });

          try {
            if (contractorRpc.organization_id) {
              const rr = await fetchOrgRating(contractorRpc.organization_id);
              if (!alive) return;
              setRatingAvg(rr.avg);
              setRatingCount(rr.count || null);
            } else {
              setRatingAvg(0);
              setRatingCount(null);
            }
          } catch {
            setRatingAvg(0);
            setRatingCount(null);
          } finally {
            if (alive) setLoadingRatings(false);
          }

          if (alive) {
            setAcceptedCount(0);
            setLoadingAccepted(false);
          }
        } else {
          setOrg(null);

          try {
            const rr = await fetchInfluencerRating(p.id);
            if (!alive) return;
            setRatingAvg(rr.avg);
            setRatingCount(rr.count || null);
          } catch {
            setRatingAvg(0);
            setRatingCount(null);
          } finally {
            if (alive) setLoadingRatings(false);
          }

          try {
            const cnt = await fetchInfluencerAcceptedCount(p.id);
            if (!alive) return;
            setAcceptedCount(cnt);
          } catch {
            setAcceptedCount(0);
          } finally {
            if (alive) setLoadingAccepted(false);
          }
        }

        if (!alive) return;
        setLoadedId(id);
        setLoading(false);
      } catch (e: any) {
        console.error("PUBLIC_PROFILE_ERROR", e);
        if (!alive) return;

        setProfile(null);
        setOrg(null);
        setLoading(false);
        setLoadingRatings(false);
        setLoadingAccepted(false);
        setLoadedId(id);
        toast.error(e?.message || "Erro ao carregar perfil.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!user || userRole !== "influencer" || role !== "contractor" || !profile?.id) {
        if (!alive) return;
        setReviewableCampaignId(null);
        setReviewableCampaignTitle(null);
        setCheckingReviewable(false);
        return;
      }

      setCheckingReviewable(true);

      try {
        const { data, error } = await supabase.rpc(
          "get_influencer_reviewable_campaign_with_business",
          { p_business_id: profile.id }
        );

        if (error) throw error;

        const row = (Array.isArray(data) ? data[0] : data) as ReviewableBusinessCampaignRow | null;

        if (!alive) return;

        setReviewableCampaignId(row?.campaign_id ? String(row.campaign_id) : null);
        setReviewableCampaignTitle(row?.title ? String(row.title) : null);
      } catch (e) {
        console.error("CHECK_REVIEWABLE_BUSINESS_ERROR", e);
        if (!alive) return;
        setReviewableCampaignId(null);
        setReviewableCampaignTitle(null);
      } finally {
        if (alive) setCheckingReviewable(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user, userRole, role, profile?.id]);

  const isVerified = useMemo(() => String((profile as any)?.approval_status ?? "").toLowerCase() === "approved", [profile]);

  const headerName = useMemo(() => {
    if (role === "contractor") return (org?.name || profile?.name || "Negócio").toString();
    return (profile?.name || "Creator").toString();
  }, [role, org?.name, profile?.name]);

  const roleLabel = useMemo(() => {
    return role === "contractor" ? "Marca/Negócios" : "Creator";
  }, [role]);

  const headerBio = useMemo(() => {
    const b = role === "contractor" ? org?.bio : profile?.bio;
    return (b || "").trim();
  }, [role, org?.bio, profile?.bio]);

  const igHandle = useMemo(() => {
    const raw = role === "contractor" ? org?.instagram : profile?.instagram;
    return buildInstagramLinks(raw)?.raw ?? null;
  }, [role, org?.instagram, profile?.instagram]);

  const followersNum = useMemo(() => {
    const raw = String(profile?.followers ?? "").trim();
    if (!raw) return null;
    const n = Number(raw.replace(/[^\d]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [profile?.followers]);

  const followersCompact = useMemo(() => formatIGCount(followersNum), [followersNum]);

  const contentStylePrimary = useMemo(() => {
    const raw = String(profile?.content_style ?? "").trim();
    if (!raw) return "—";
    return (
      raw
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)[0] ?? "—"
    );
  }, [profile?.content_style]);

  const stateUF = (profile?.state || "").toString();
  const cityLabel = (profile?.city || "—").toString();
  const neighborhoodLabel = (profile?.neighborhood || "—").toString();

  const stateMapsQuery = stateUF ? `${stateUF}, Brasil` : "";
  const cityMapsQuery =
    stateUF && cityLabel && cityLabel !== "—" ? `${cityLabel}, ${stateUF}, Brasil` : cityLabel !== "—" ? `${cityLabel}, Brasil` : "";
  const neighborhoodMapsQuery =
    stateUF && cityLabel && neighborhoodLabel && neighborhoodLabel !== "—"
      ? `${neighborhoodLabel}, ${cityLabel}, ${stateUF}, Brasil`
      : neighborhoodLabel !== "—"
        ? `${neighborhoodLabel}, Brasil`
        : "";

  const contractorLocationLabel = useMemo(() => {
    const c = org?.region_city || profile?.city;
    const s = org?.region_state || profile?.state;
    if (c && s) return `${c}, ${s}`;
    if (c) return String(c);
    return "—";
  }, [org?.region_city, org?.region_state, profile?.city, profile?.state]);

  const openContractorMaps = () => {
    const parts = [
      org?.address_street,
      org?.address_number,
      org?.address_complement,
      org?.address_zip,
      org?.region_city || profile?.city,
      org?.region_state || profile?.state,
    ]
      .map((x: any) => (x || "").toString().trim())
      .filter(Boolean);

    const q = parts.length ? parts.join(", ") : contractorLocationLabel;
    openMapsQuery(q);
  };

  const website = useMemo(() => safeUrl(org?.website_url), [org?.website_url]);

  const gender = useMemo(() => {
    const g = (profile as any)?.audience_gender;
    if (!g || typeof g !== "object") return null;
    const female = typeof g.female === "number" ? clamp(g.female, 0, 100) : null;
    const male = typeof g.male === "number" ? clamp(g.male, 0, 100) : null;
    if (female === null && male === null) return null;
    if (female !== null && male === null) return { female, male: 100 - female };
    if (male !== null && female === null) return { male, female: 100 - male };
    return { female: female!, male: male! };
  }, [profile]);

  const audienceAge = useMemo(() => {
    const a = (profile as any)?.audience_age;
    if (!a || typeof a !== "object") return null;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(a)) {
      const n = Number(v);
      if (Number.isFinite(n)) out[String(k)] = n;
    }
    return Object.keys(out).length ? out : null;
  }, [profile]);

  const ready = !!id && loadedId === id && !loading;

  const canReviewThisBusiness =
    userRole === "influencer" &&
    role === "contractor" &&
    !!user &&
    !!profile?.id &&
    !!reviewableCampaignId;

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    navigate(-1);
  };

  const openReviewModal = () => {
    if (!canReviewThisBusiness) return;
    setReviewRating(0);
    setReviewComment("");
    setReviewOpen(true);
  };

  const closeReviewModal = () => {
    if (reviewSubmitting) return;
    setReviewOpen(false);
    setReviewRating(0);
    setReviewComment("");
  };

  const submitBusinessReview = async () => {
    if (!user || !profile?.id || !reviewableCampaignId) return;

    if (reviewRating < 1 || reviewRating > 5) {
      toast.error("Escolha uma nota de 1 a 5.");
      return;
    }

    setReviewSubmitting(true);
    try {
      const { error } = await supabase.from("campaign_reviews").insert({
        campaign_id: reviewableCampaignId,
        influencer_id: user.id,
        business_id: profile.id,
        reviewer_role: "influencer",
        rating: reviewRating,
        comment: reviewComment.trim() || null,
      });

      if (error) throw error;

      toast.success("Avaliação enviada com sucesso.");
      setReviewableCampaignId(null);
      setReviewableCampaignTitle(null);
      closeReviewModal();
    } catch (e: any) {
      console.error("SUBMIT_PUBLIC_BUSINESS_REVIEW_ERROR", e);
      toast.error(e?.message || "Erro ao enviar avaliação.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const pageContent = (
    <div className="px-6 py-6 space-y-6">
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      {!ready ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : !profile ? (
        <div className="py-10 text-center">
          <p className="text-sm text-muted-foreground">Perfil não encontrado.</p>
        </div>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-white/5 shadow-sm">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5" />
              <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:16px_16px]" />
            </div>

            <div className="relative p-5">
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <div className="absolute -inset-2 rounded-3xl bg-primary/10 blur-lg opacity-60" />
                  <div className="relative w-20 h-20 rounded-3xl overflow-hidden border border-primary/20 bg-white/5 flex items-center justify-center">
                    {role === "contractor" ? (
                      org?.logo_url ? (
                        <img src={org.logo_url} alt="Logo" className="w-full h-full object-cover block" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-primary font-bold">{initials(headerName)}</span>
                      )
                    ) : profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover block" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-primary font-bold">{initials(headerName)}</span>
                    )}
                  </div>

                  <div className="pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-white/10" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <h1 className="text-xl font-semibold text-foreground leading-tight break-words">{headerName}</h1>
                    {isVerified ? (
                      <span className="shrink-0">
                        <VerifiedBadge size="sm" />
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground">{roleLabel}</div>

                  <div className="mt-2 text-sm text-foreground/90 leading-relaxed">
                    {headerBio ? <span className="block line-clamp-1">{headerBio}</span> : <span className="text-muted-foreground">Sem descrição.</span>}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <IconButton
                  icon={<Instagram className="w-4 h-4" />}
                  label={igHandle ? `@${igHandle}` : "Instagram"}
                  onClick={() => openInstagram(role === "contractor" ? org?.instagram : profile.instagram)}
                  disabled={!igHandle}
                  className="w-full justify-center"
                />

                {role === "contractor" ? (
                  <IconButton
                    icon={<Globe className="w-4 h-4" />}
                    label="Site"
                    onClick={() => (website ? window.open(website, "_blank", "noopener,noreferrer") : null)}
                    disabled={!website}
                    className="w-full justify-center"
                  />
                ) : (
                  <IconButton
                    icon={<MapPin className="w-4 h-4" />}
                    label="Maps"
                    onClick={() => openMapsQuery([neighborhoodLabel, cityLabel, stateUF].filter((x) => x && x !== "—").join(", "))}
                    disabled={!cityLabel || cityLabel === "—"}
                    className="w-full justify-center"
                  />
                )}
              </div>
            </div>
          </div>

          {role === "contractor" ? (
            <div className="grid grid-cols-3 gap-2">
              <LocationInfoChip
                icon={<MapPin className="w-4 h-4" />}
                label="Localização"
                value={contractorLocationLabel}
                title="Abrir no Google Maps"
                onClick={openContractorMaps}
              />
              <MicroChip icon={<Building2 className="w-4 h-4" />} label="Categoria" value={(org?.business_category || "—").trim() || "—"} />
              <MicroChip icon={<Package className="w-4 h-4" />} label="Produto" value={(org?.product_or_brand || "—").trim() || "—"} />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <MicroChip
                icon={<Users className="w-4 h-4" />}
                label="Seguidores"
                value={followersCompact}
                title={followersNum ? `Seguidores: ${followersNum.toLocaleString("pt-BR")}` : "—"}
              />
              <MicroChip icon={<Sparkles className="w-4 h-4" />} label="Conteúdo" value={contentStylePrimary} title={contentStylePrimary} />
              <MicroChip icon={<MapPin className="w-4 h-4" />} label="Localização" value={cityLabel || "—"} title={`Cidade: ${cityLabel}`} />
            </div>
          )}

          {role === "influencer" ? (
            <div className="glass-card p-5 shadow-sm transition hover:shadow-md hover:bg-white/[0.06]">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-primary" />
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Audiência</p>
              </div>

              <div className="space-y-4">
                <DualDonutChart
                  aPct={clamp(Number((gender as any)?.female ?? 50), 0, 100)}
                  bPct={clamp(Number((gender as any)?.male ?? 50), 0, 100)}
                  label="Gênero"
                  aLabel="Feminino"
                  bLabel="Masculino"
                />

                <AgeBarsCard data={audienceAge} buckets={[...AGE_BARS_BUCKETS]} />

                <div>
                  <div className="text-xs text-muted-foreground mb-2">Principais localizações</div>
                  <div className="grid grid-cols-3 gap-2">
                    <LocationInfoChip
                      icon={<MapIcon className="w-4 h-4" />}
                      label="Estado"
                      value={stateUF ? stateUF : "—"}
                      title={stateUF ? `Abrir no Maps: ${stateUF}` : "Estado não informado"}
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
              </div>
            </div>
          ) : null}

          <RatingsCard rating={ratingAvg} count={ratingCount} loading={loadingRatings} />

          {role === "contractor" && userRole === "influencer" && (
            <div className="glass-card p-5 shadow-sm transition hover:shadow-md hover:bg-white/[0.06]">
              <div className="text-sm font-semibold text-foreground text-center">
                Sua avaliação desta marca
              </div>

              <div className="mt-3">
                {checkingReviewable ? (
                  <div className="flex justify-center py-2">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  </div>
                ) : canReviewThisBusiness ? (
                  <button
                    type="button"
                    onClick={openReviewModal}
                    className="w-full rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-left hover:bg-primary/15 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl border border-border/50 bg-card/60 overflow-hidden flex items-center justify-center shrink-0">
                        {org?.logo_url ? (
                          <img
                            src={org.logo_url}
                            alt={headerName}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-xs font-bold text-primary">{initials(headerName)}</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-foreground truncate">
                          {headerName}
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          Campanha: {reviewableCampaignTitle || "Campanha concluída"}
                        </div>
                      </div>

                      <div className="shrink-0 text-primary">
                        <Star className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-center gap-1 text-white/20">
                      <span className="text-2xl leading-none">★</span>
                      <span className="text-2xl leading-none">★</span>
                      <span className="text-2xl leading-none">★</span>
                      <span className="text-2xl leading-none">★</span>
                      <span className="text-2xl leading-none">★</span>
                    </div>

                    <div className="mt-3 text-center text-sm font-semibold text-primary">
                      Avaliar marca/negócio
                    </div>
                  </button>
                ) : (
                  <div className="text-center text-xs text-muted-foreground">
                    Você só pode avaliar esta marca após concluir uma campanha com ela.
                  </div>
                )}
              </div>
            </div>
          )}

          {role === "influencer" ? (
            <div className="glass-card p-5 shadow-sm transition hover:shadow-md hover:bg-white/[0.06]">
              <div className="text-sm font-semibold text-foreground text-center">Ativações e campanhas</div>

              {loadingAccepted ? (
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
                  <div className="text-xs text-muted-foreground">Realizadas:</div>
                  <div className="mt-1 text-2xl font-semibold text-foreground">{acceptedCount}</div>
                </div>
              )}
            </div>
          ) : null}
        </>
      )}

      <AnimatePresence>
        {reviewOpen && role === "contractor" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeReviewModal();
            }}
          >
            <div className="fixed inset-0 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="w-full max-w-[520px] rounded-3xl border border-border/50 bg-background/95 shadow-2xl overflow-hidden"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="px-5 pt-5 pb-4 border-b border-border/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex items-start gap-3">
                      <div className="w-14 h-14 rounded-2xl border border-border/50 bg-card/60 overflow-hidden flex items-center justify-center shrink-0">
                        {org?.logo_url ? (
                          <img
                            src={org.logo_url}
                            alt={headerName}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-xs font-bold text-primary">{initials(headerName)}</span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground uppercase tracking-widest">
                          Avaliação
                        </div>
                        <div className="mt-1 text-lg font-bold text-foreground truncate">
                          {headerName}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          Campanha: {reviewableCampaignTitle || "Campanha concluída"}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={closeReviewModal}
                      className="w-10 h-10 rounded-2xl border border-border/50 bg-card/60 hover:bg-card/80 transition flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="px-5 py-5 space-y-5">
                  <div>
                    <div className="text-sm font-semibold text-foreground text-center mb-3">
                      Nota de 1 a 5
                    </div>

                    <div className="flex items-center justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((n) => {
                        const active = n <= reviewRating;
                        return (
                          <button
                            key={n}
                            type="button"
                            disabled={reviewSubmitting}
                            onClick={() => setReviewRating(n)}
                            className={`text-3xl leading-none transition ${
                              active ? "text-yellow-400" : "text-white/20"
                            } disabled:opacity-60`}
                          >
                            ★
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-foreground mb-2">
                      Comentário
                    </div>
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      disabled={reviewSubmitting}
                      rows={4}
                      placeholder="Opcional"
                      className="w-full rounded-2xl border border-border/50 bg-card/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-70"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={submitBusinessReview}
                    disabled={reviewSubmitting || reviewRating < 1}
                    className="w-full min-h-[44px] rounded-2xl bg-gradient-neon text-primary-foreground font-semibold text-sm glow-blue disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {reviewSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                    {reviewSubmitting ? "Enviando..." : "Enviar avaliação"}
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (isEmbed) {
    return <div className="min-h-full bg-background">{pageContent}</div>;
  }

  return (
    <MobileLayout
      title="Perfil"
      showBack
      backTo={backTo}
      navType={userRole === "contractor" ? "contractor" : "influencer"}
      showNav={false}
      showHome={false}
    >
      {pageContent}
    </MobileLayout>
  );
}