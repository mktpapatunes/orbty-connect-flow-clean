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
  ExternalLink,
  Pencil,
  Shield,
  Sparkles,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useNavigate } from "react-router-dom";

/* =========================
   UI helpers
========================= */

function GlassCard(props: { children: React.ReactNode; className?: string }) {
  return <div className={`glass-card p-5 ${props.className ?? ""}`}>{props.children}</div>;
}

function MetricCard(props: { label: string; value: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur shadow-sm transition
      hover:bg-white/10 hover:shadow-md hover:-translate-y-[1px] active:scale-[0.99] ${props.className ?? ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">{props.label}</div>
        {props.icon}
      </div>
      <div className="mt-2 text-xl font-semibold text-foreground">{props.value}</div>
    </div>
  );
}

function initials(name?: string | null) {
  const n = (name || "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
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

/* ---------- Premium UI blocks (safe, UI-only) ---------- */

function SectionShell(props: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass-card p-5 shadow-sm transition hover:shadow-md hover:bg-white/[0.06] ${props.className ?? ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">{props.title}</div>
          {props.subtitle ? <div className="text-xs text-muted-foreground mt-1">{props.subtitle}</div> : null}
        </div>
        {props.action ? <div className="shrink-0">{props.action}</div> : null}
      </div>
      <div className="mt-4">{props.children}</div>
    </div>
  );
}

function SkeletonLine({ w = "100%", h = 12 }: { w?: string; h?: number }) {
  return <div className="animate-pulse rounded-xl bg-white/10" style={{ width: w, height: h }} />;
}

function IconButton(props: { icon: React.ReactNode; label: string; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`inline-flex items-center gap-2 rounded-xl border border-border/50 bg-white/5 px-3 py-2 text-sm text-foreground transition
      hover:bg-white/10 hover:shadow-sm active:scale-[0.99] ${props.className ?? ""}`}
    >
      <span className="text-primary">{props.icon}</span>
      <span className="hidden sm:inline">{props.label}</span>
      <span className="sm:hidden">{props.label}</span>
    </button>
  );
}

/** Chip menor, largura total e altura fixa (encaixe perfeito) */
function ChipButton(props: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      className={`w-full h-10 inline-flex items-center justify-between gap-2 rounded-2xl border border-border/50 bg-white/5 px-3
      text-xs text-foreground/90 transition shadow-sm
      hover:bg-white/10 hover:border-border/70 hover:shadow-md active:scale-[0.99]
      disabled:opacity-60 disabled:hover:bg-white/5 disabled:hover:shadow-sm ${props.className ?? ""}`}
    >
      <span className="inline-flex items-center gap-2 min-w-0">
        <span className="text-primary shrink-0">{props.icon}</span>
        <span className="truncate leading-none">{props.label}</span>
      </span>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
    </button>
  );
}

/** Donut dual via SVG (premium) */
function DualDonutChart(props: {
  aPct: number; // 0..100
  bPct: number; // 0..100
  label: string;
  aLabel: string;
  bLabel: string;
  badge?: string;
}) {
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
        {props.badge ? (
          <div className="text-[10px] px-2 py-1 rounded-full border border-border/50 bg-white/5 text-muted-foreground">
            {props.badge}
          </div>
        ) : null}
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

function VerifiedOrbtyCard(props: { verified: boolean; updatedAt?: string | null }) {
  const updatedLabel = props.updatedAt ? new Date(props.updatedAt).toLocaleDateString("pt-BR") : null;

  return (
    <div className="rounded-2xl border border-border/50 bg-white/5 p-4 shadow-sm transition hover:bg-white/10 hover:shadow-md hover:-translate-y-[1px] active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <div className="text-sm font-semibold text-foreground">Verificado Orbty</div>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {props.verified ? "Conta aprovada na Orbty." : "Sua conta ainda não está marcada como verificada."}
          </div>
          {updatedLabel ? <div className="mt-2 text-[11px] text-muted-foreground">Atualizado em {updatedLabel}</div> : null}
        </div>

        <div
          className={`text-[10px] px-2 py-1 rounded-full border bg-white/5 ${
            props.verified ? "border-emerald-400/20 text-emerald-200" : "border-border/50 text-muted-foreground"
          }`}
          title="Conta aprovada na Orbty"
        >
          {props.verified ? "aprovado" : "pendente"}
        </div>
      </div>
    </div>
  );
}

function SoftPill(props: { icon?: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-white/5 px-3 py-2 text-xs text-foreground/90">
      {props.icon ? <span className="text-primary">{props.icon}</span> : null}
      {props.label}
    </span>
  );
}

/* =========================
   Types / parsing
========================= */

type ObjNum = Record<string, number>;

const AGE_BUCKETS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;

function parseObjectNumbers(v: any): ObjNum | null {
  if (!v || typeof v !== "object") return null;
  const out: ObjNum = {};
  for (const [k, val] of Object.entries(v)) {
    const num = Number(val);
    if (!Number.isNaN(num)) out[String(k)] = num;
  }
  return Object.keys(out).length ? out : null;
}

function topKeys(obj: ObjNum | null | undefined, top = 3) {
  if (!obj) return [];
  return Object.entries(obj)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, top)
    .map(([k]) => k);
}

function safeCommaListToArray(v?: string | null) {
  const raw = (v || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function safeArrayToCommaList(arr: string[]) {
  return (arr || [])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
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

  // Audience extra (cidades/idades) — pega do profile primeiro
  const audienceCities = useMemo<ObjNum | null>(() => {
    return (
      parseObjectNumbers((profile as any)?.audience_cities) ||
      parseObjectNumbers((ctx.data as any)?.audience_cities) ||
      null
    );
  }, [profile, ctx.data]);

  const audienceAge = useMemo<ObjNum | null>(() => {
    return (
      parseObjectNumbers((profile as any)?.audience_age) ||
      parseObjectNumbers((ctx.data as any)?.audience_age) ||
      null
    );
  }, [profile, ctx.data]);

  const topCities = useMemo(() => topKeys(audienceCities, 4), [audienceCities]);

  const topAges = useMemo(() => {
    const merged: ObjNum = {};
    for (const k of AGE_BUCKETS) merged[k] = 0;

    if (audienceAge) {
      for (const [k, v] of Object.entries(audienceAge)) {
        merged[k] = (merged[k] ?? 0) + (Number.isFinite(v) ? v : 0);
      }
    }

    const hasAny = Object.values(merged).some((x) => (x ?? 0) > 0);
    if (!hasAny) return topKeys(audienceAge, 3);

    return Object.entries(merged)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .slice(0, 3)
      .map(([k]) => k);
  }, [audienceAge]);

  // Orbty success only
  const [orbtyAccepted, setOrbtyAccepted] = useState(0);
  const [orbtyTotal, setOrbtyTotal] = useState(0);
  const [loadingOrbty, setLoadingOrbty] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!profile?.id) return;
      setLoadingOrbty(true);

      const rpcMetrics = (ctx.data as any)?.influencer_metrics;
      if (rpcMetrics) {
        if (!alive) return;
        setOrbtyTotal(Number(rpcMetrics.total_applications ?? 0));
        setOrbtyAccepted(Number(rpcMetrics.accepted_applications ?? 0));
        setLoadingOrbty(false);
        return;
      }

      const { data, error } = await supabase
        .from("campaign_applications")
        .select("status")
        .eq("influencer_id", profile.id);

      if (!alive) return;

      if (error) {
        console.error(error);
        setLoadingOrbty(false);
        return;
      }

      const list = data ?? [];
      setOrbtyTotal(list.length);
      setOrbtyAccepted(list.filter((x: any) => x.status === "accepted").length);
      setLoadingOrbty(false);
    })();

    return () => {
      alive = false;
    };
  }, [profile?.id, ctx.data]);

  const successRate = useMemo(() => {
    if (!orbtyTotal) return 0;
    return (orbtyAccepted / orbtyTotal) * 100;
  }, [orbtyAccepted, orbtyTotal]);

  const igHandle = (profile as any)?.instagram ?? null;
  const igRaw = buildInstagramLinks(igHandle)?.raw ?? null;

  const followersLabel =
    instagram?.followers_count === null || instagram?.followers_count === undefined
      ? "—"
      : Number(instagram.followers_count).toLocaleString("pt-BR");

  const femalePct = clamp(Number(instagram?.audience_female_pct ?? 50), 0, 100);
  const malePct = clamp(Number(instagram?.audience_male_pct ?? (100 - femalePct)), 0, 100);

  const locationLabel = profile ? `${profile.city}, ${profile.state}` : "—";

  // Conteúdo: estilos do perfil (sem inventar)
  const contentStyles = useMemo(() => safeCommaListToArray((profile as any)?.content_style ?? ""), [profile]);

  /* =========================
     EDIT PROFILE MODAL (popup)
  ========================= */

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showAllCities, setShowAllCities] = useState(false);

  const [form, setForm] = useState(() => ({
    name: (profile as any)?.name ?? "",
    city: (profile as any)?.city ?? "",
    state: (profile as any)?.state ?? "",
    neighborhood: (profile as any)?.neighborhood ?? "",
    bio: (profile as any)?.bio ?? "",

    instagram_username: (profile as any)?.instagram ?? "",
    followers_count: Number(instagram?.followers_count ?? 0),

    audience_female_pct: femalePct,
    audience_male_pct: malePct,

    content_styles: safeCommaListToArray((profile as any)?.content_style ?? ""),

    audience_city_1: topCities?.[0] ?? "",
    audience_city_2: topCities?.[1] ?? "",
    audience_city_3: topCities?.[2] ?? "",
    audience_city_4: topCities?.[3] ?? "",

    age_top_1: topAges?.[0] ?? "",
    age_top_2: topAges?.[1] ?? "",
    age_top_3: topAges?.[2] ?? "",
  }));

  useEffect(() => {
    if (!editOpen) return;

    setForm({
      name: (profile as any)?.name ?? "",
      city: (profile as any)?.city ?? "",
      state: (profile as any)?.state ?? "",
      neighborhood: (profile as any)?.neighborhood ?? "",
      bio: (profile as any)?.bio ?? "",

      instagram_username: (profile as any)?.instagram ?? "",
      followers_count: Number(instagram?.followers_count ?? 0),

      audience_female_pct: clamp(Number(instagram?.audience_female_pct ?? 50), 0, 100),
      audience_male_pct: clamp(Number(instagram?.audience_male_pct ?? 50), 0, 100),

      content_styles: safeCommaListToArray((profile as any)?.content_style ?? ""),

      audience_city_1: topCities?.[0] ?? "",
      audience_city_2: topCities?.[1] ?? "",
      audience_city_3: topCities?.[2] ?? "",
      audience_city_4: topCities?.[3] ?? "",

      age_top_1: topAges?.[0] ?? "",
      age_top_2: topAges?.[1] ?? "",
      age_top_3: topAges?.[2] ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOpen]);

  const STYLE_OPTIONS = [
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
  ];

  const toggleStyle = (style: string) => {
    setForm((s) => {
      const exists = s.content_styles.includes(style);
      if (exists) return { ...s, content_styles: s.content_styles.filter((x) => x !== style) };
      if (s.content_styles.length >= 3) return s;
      return { ...s, content_styles: [...s.content_styles, style] };
    });
  };

  const saveEditProfile = async () => {
    if (!profile?.id) return;

    if (!form.name.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }

    const female = clamp(Number(form.audience_female_pct || 0), 0, 100);
    const male = clamp(Number(form.audience_male_pct || 0), 0, 100);

    setSaving(true);
    try {
      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          name: form.name.trim(),
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          neighborhood: form.neighborhood.trim() || null,
          bio: form.bio.trim() || null,

          instagram: form.instagram_username.trim() || null,
          followers: String(Math.max(0, Number(form.followers_count || 0))),

          content_style: safeArrayToCommaList(form.content_styles) || null,

          audience_gender: { female, male },
          audience_cities: {
            ...(form.audience_city_1.trim() ? { [form.audience_city_1.trim()]: 1 } : {}),
            ...(form.audience_city_2.trim() ? { [form.audience_city_2.trim()]: 1 } : {}),
            ...(form.audience_city_3.trim() ? { [form.audience_city_3.trim()]: 1 } : {}),
            ...(form.audience_city_4.trim() ? { [form.audience_city_4.trim()]: 1 } : {}),
          },
          audience_age: {
            ...(form.age_top_1 ? { [form.age_top_1]: 1 } : {}),
            ...(form.age_top_2 ? { [form.age_top_2]: 1 } : {}),
            ...(form.age_top_3 ? { [form.age_top_3]: 1 } : {}),
          },
        })
        .eq("id", profile.id);

      if (pErr) throw pErr;

      await updateMyInstagramStats({
        instagram_username: form.instagram_username,
        followers_count: Number(form.followers_count || 0),
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
                  {avatarUploading ? (
                    <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4 text-primary-foreground" />
                  )}
                </button>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleAvatarFile(e.target.files?.[0])}
                />
              </div>

              {/* infos ao lado */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-xl font-semibold text-foreground leading-tight break-words">
                    {profile?.name || "Creator"}
                  </h1>
                  {isVerifiedInfluencer ? (
                    <span className="shrink-0">
                      <VerifiedBadge size="sm" />
                    </span>
                  ) : null}
                </div>

                {/* ✅ chips: lado a lado + mesmo tamanho + encaixe perfeito */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <ChipButton
                    icon={<Instagram className="w-4 h-4" />}
                    label={igRaw ? `@${igRaw}` : "Instagram"}
                    disabled={!igRaw}
                    onClick={() => openInstagram(igHandle)}
                    title="Abrir Instagram"
                  />

                  <ChipButton
                    icon={<MapPin className="w-4 h-4" />}
                    label={profile?.city ? profile.city : "Localização"}
                    onClick={() => {
                      const q = encodeURIComponent(locationLabel);
                      window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener,noreferrer");
                    }}
                    title="Abrir no Maps"
                  />
                </div>
              </div>
            </div>

            {/* botões do header (largura igual) */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <IconButton
                icon={<Pencil className="w-4 h-4" />}
                label="Editar perfil"
                onClick={() => setEditOpen(true)}
                className="w-full justify-center"
              />
              <IconButton
                icon={<Shield className="w-4 h-4" />}
                label="Dados pessoais"
                onClick={() => navigate("/perfil-influenciadora/dados-pessoais")}
                className="w-full justify-center"
              />
            </div>
          </div>
        </div>

        {/* RESUMO RÁPIDO */}
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => openInstagram(igHandle)}
            disabled={!igRaw}
            className={`rounded-2xl border p-4 text-left transition shadow-sm
              ${
                igRaw
                  ? "border-border/50 bg-white/5 hover:bg-white/10 hover:shadow-md hover:-translate-y-[1px]"
                  : "border-border/30 bg-white/5 opacity-60"
              }
              active:scale-[0.99]`}
          >
            <div className="flex items-center justify-between">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-white/5 text-muted-foreground">
                público
              </span>
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Seguidores</p>
            <p className="text-sm font-semibold text-foreground truncate">
              {instagram?.followers_count === null || instagram?.followers_count === undefined
                ? "—"
                : Number(instagram.followers_count).toLocaleString("pt-BR")}
            </p>
          </button>

          <div className="rounded-2xl border border-border/50 bg-white/5 p-4 text-left transition shadow-sm hover:bg-white/10 hover:shadow-md hover:-translate-y-[1px] active:scale-[0.99]">
            <div className="flex items-center justify-between">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-white/5 text-muted-foreground">
                orbty
              </span>
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Taxa de sucesso</p>
            <p className="text-sm font-semibold text-foreground truncate">
              {loadingOrbty ? "—" : `${Math.round(successRate)}%`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              const q = encodeURIComponent(locationLabel);
              window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener,noreferrer");
            }}
            className="rounded-2xl border border-border/50 bg-white/5 hover:bg-white/10 hover:shadow-md hover:-translate-y-[1px] p-4 text-left transition shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <MapPin className="w-4 h-4 text-primary" />
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Top cidade</p>
            <p className="text-sm font-semibold text-foreground truncate">{profile?.city || "—"}</p>
          </button>
        </div>

        {/* VISÃO GERAL */}
        <SectionShell
          title="Visão geral"
          subtitle="Informações principais do seu perfil"
          action={
            <button
              onClick={() => setEditOpen(true)}
              className="text-xs px-3 py-2 rounded-xl border border-border/50 bg-white/5 hover:bg-white/10 transition text-muted-foreground hover:text-foreground inline-flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" />
              Editar
            </button>
          }
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/50 bg-white/5 p-4">
              <div className="text-xs text-muted-foreground">Bio</div>
              <div className="mt-2 text-sm text-foreground leading-relaxed">
                {(profile as any)?.bio ? (
                  (profile as any)?.bio
                ) : (
                  <span className="text-muted-foreground">Adicione uma bio para deixar seu perfil mais completo.</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <SoftPill icon={<MapPin className="w-4 h-4" />} label={locationLabel} />
              <SoftPill icon={<Instagram className="w-4 h-4" />} label={igRaw ? `@${igRaw}` : "Instagram não informado"} />
              <SoftPill icon={<Users className="w-4 h-4" />} label={`Seguidores: ${followersLabel}`} />
            </div>
          </div>
        </SectionShell>

        {/* AUDIÊNCIA */}
        <SectionShell
          title="Audiência"
          subtitle="Dados informados por você (por enquanto)"
          action={
            <button
              onClick={() => setEditOpen(true)}
              className="text-xs px-3 py-2 rounded-xl border border-border/50 bg-white/5 hover:bg-white/10 transition text-muted-foreground hover:text-foreground inline-flex items-center gap-2"
              title="Editar audiência no Editar perfil"
            >
              <Sparkles className="w-4 h-4" />
              Editar
            </button>
          }
        >
          <DualDonutChart
            aPct={femalePct}
            bPct={malePct}
            label="Gênero"
            aLabel="Feminino"
            bLabel="Masculino"
            badge="premium"
          />

          <div className="rounded-2xl border border-border/50 bg-white/5 p-4 mt-4 shadow-sm transition hover:bg-white/10 hover:shadow-md hover:-translate-y-[1px] active:scale-[0.99]">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Faixa etária (Top)</div>
              <div className="text-[10px] px-2 py-1 rounded-full border border-border/50 bg-white/5 text-muted-foreground">
                top
              </div>
            </div>

            {topAges.length === 0 ? (
              <div className="mt-3 text-sm text-muted-foreground">Sem dados de faixa etária.</div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {topAges.map((age) => (
                  <span
                    key={age}
                    className="text-xs px-3 py-2 rounded-full border border-border/50 bg-white/5 text-foreground/90 hover:bg-white/10 transition"
                  >
                    {age}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border/50 bg-white/5 p-4 mt-4 shadow-sm transition hover:bg-white/10 hover:shadow-md hover:-translate-y-[1px] active:scale-[0.99]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Principais cidades</div>
                <div className="text-[11px] text-muted-foreground mt-1">Sem números, só destaque</div>
              </div>

              {topCities.length > 3 ? (
                <button
                  type="button"
                  onClick={() => setShowAllCities((s) => !s)}
                  className="text-xs px-3 py-2 rounded-xl border border-border/50 bg-white/5 hover:bg-white/10 transition text-muted-foreground hover:text-foreground"
                >
                  {showAllCities ? "Ver menos" : "Ver mais"}
                </button>
              ) : null}
            </div>

            {topCities.length === 0 ? (
              <div className="mt-3 text-sm text-muted-foreground">Sem dados de cidades.</div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {(showAllCities ? topCities : topCities.slice(0, 3)).map((city) => (
                  <span
                    key={city}
                    className="text-xs px-3 py-2 rounded-full border border-border/50 bg-white/5 text-foreground/90 hover:bg-white/10 transition"
                  >
                    {city}
                  </span>
                ))}
              </div>
            )}
          </div>
        </SectionShell>

        {/* CONTEÚDO */}
        <SectionShell
          title="Conteúdo"
          subtitle="Como sua criação aparece para marcas"
          action={
            <button
              onClick={() => setEditOpen(true)}
              className="text-xs px-3 py-2 rounded-xl border border-border/50 bg-white/5 hover:bg-white/10 transition text-muted-foreground hover:text-foreground inline-flex items-center gap-2"
              title="Editar estilos no Editar perfil"
            >
              <Pencil className="w-4 h-4" />
              Editar
            </button>
          }
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/50 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">Estilos de conteúdo</div>
                <div className="text-[10px] px-2 py-1 rounded-full border border-border/50 bg-white/5 text-muted-foreground">
                  até 3
                </div>
              </div>

              {contentStyles.length === 0 ? (
                <div className="mt-3 text-sm text-muted-foreground">
                  Nenhum estilo selecionado. Adicione até 3 para deixar seu perfil mais atrativo.
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {contentStyles.map((s) => (
                    <span key={s} className="text-xs px-3 py-2 rounded-full border border-primary/20 bg-primary/10 text-primary">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border/50 bg-white/5 p-4">
              <div className="text-xs text-muted-foreground">Dica</div>
              <div className="mt-2 text-sm text-foreground/90">
                Perfis com bio clara + estilos definidos costumam converter melhor em campanhas.
              </div>
            </div>
          </div>
        </SectionShell>

        {/* CONFIANÇA */}
        <SectionShell title="Confiança (Orbty)" subtitle="Sinais de credibilidade da sua conta">
          <VerifiedOrbtyCard verified={isVerifiedInfluencer} updatedAt={(profile as any)?.updated_at ?? null} />
        </SectionShell>

        {/* PERFORMANCE */}
        <SectionShell title="Performance na Orbty" subtitle="Participações com sucesso">
          {loadingOrbty ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border/50 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">Aceites</div>
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="mt-3 space-y-2">
                  <SkeletonLine w="40%" h={18} />
                  <SkeletonLine w="70%" h={10} />
                </div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">Taxa de sucesso</div>
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="mt-3 space-y-2">
                  <SkeletonLine w="55%" h={18} />
                  <SkeletonLine w="80%" h={10} />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Aceites" value={orbtyAccepted} />
              <MetricCard label="Taxa de sucesso" value={`${Math.round(successRate)}%`} />
            </div>
          )}
        </SectionShell>

        {/* MODAL: Editar perfil completo */}
        {editOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
            <div className="absolute inset-0 bg-black/60" onMouseDown={() => (saving ? null : setEditOpen(false))} />

            <div
              className="relative w-full md:max-w-lg rounded-t-3xl md:rounded-3xl border border-border/50 bg-background p-5"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">Editar perfil</div>
                <button className="p-2 rounded-xl hover:bg-white/5" onClick={() => (saving ? null : setEditOpen(false))} type="button">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-5 max-h-[70vh] overflow-auto pr-1">
                {/* ... MODAL (mantido igual) ... */}
                {/* (mantive todo o conteúdo do modal exatamente como estava) */}

                {/* Básico */}
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-widest">Informações</div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Nome *</Label>
                    <Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} className="text-sm" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Cidade</Label>
                      <Input value={form.city} onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))} className="text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Estado</Label>
                      <Input value={form.state} onChange={(e) => setForm((s) => ({ ...s, state: e.target.value }))} className="text-sm" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Bairro</Label>
                    <Input value={form.neighborhood} onChange={(e) => setForm((s) => ({ ...s, neighborhood: e.target.value }))} className="text-sm" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Bio</Label>
                    <Input value={form.bio} onChange={(e) => setForm((s) => ({ ...s, bio: e.target.value }))} className="text-sm" />
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

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Seguidores</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.followers_count}
                      onChange={(e) => setForm((s) => ({ ...s, followers_count: Number(e.target.value || 0) }))}
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* Audiência (gênero) */}
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-widest">Audiência</div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Feminino (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={form.audience_female_pct}
                        onChange={(e) => {
                          const female = clamp(Number(e.target.value || 0), 0, 100);
                          const male = clamp(100 - female, 0, 100);
                          setForm((s) => ({ ...s, audience_female_pct: female, audience_male_pct: male }));
                        }}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Masculino (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={form.audience_male_pct}
                        onChange={(e) => {
                          const male = clamp(Number(e.target.value || 0), 0, 100);
                          const female = clamp(100 - male, 0, 100);
                          setForm((s) => ({ ...s, audience_male_pct: male, audience_female_pct: female }));
                        }}
                        className="text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Ajuste rápido (Feminino)</Label>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Feminino: {clamp(Number(form.audience_female_pct || 0), 0, 100)}%</span>
                      <span>Masculino: {clamp(Number(form.audience_male_pct || 0), 0, 100)}%</span>
                    </div>
                    <Slider
                      value={[clamp(Number(form.audience_female_pct || 0), 0, 100)]}
                      onValueChange={(v) => {
                        const female = clamp(v[0], 0, 100);
                        const male = clamp(100 - female, 0, 100);
                        setForm((s) => ({ ...s, audience_female_pct: female, audience_male_pct: male }));
                      }}
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Cidade #1</Label>
                      <Input value={form.audience_city_1} onChange={(e) => setForm((s) => ({ ...s, audience_city_1: e.target.value }))} className="text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Cidade #2</Label>
                      <Input value={form.audience_city_2} onChange={(e) => setForm((s) => ({ ...s, audience_city_2: e.target.value }))} className="text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Cidade #3</Label>
                      <Input value={form.audience_city_3} onChange={(e) => setForm((s) => ({ ...s, audience_city_3: e.target.value }))} className="text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Cidade #4</Label>
                      <Input value={form.audience_city_4} onChange={(e) => setForm((s) => ({ ...s, audience_city_4: e.target.value }))} className="text-sm" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Idade Top #1</Label>
                      <Input value={form.age_top_1} onChange={(e) => setForm((s) => ({ ...s, age_top_1: e.target.value }))} placeholder="18-24" className="text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Idade Top #2</Label>
                      <Input value={form.age_top_2} onChange={(e) => setForm((s) => ({ ...s, age_top_2: e.target.value }))} placeholder="25-34" className="text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Idade Top #3</Label>
                      <Input value={form.age_top_3} onChange={(e) => setForm((s) => ({ ...s, age_top_3: e.target.value }))} placeholder="35-44" className="text-sm" />
                    </div>
                  </div>

                  <div className="text-[11px] text-muted-foreground">Sugestão de faixas: {AGE_BUCKETS.join(" · ")}</div>
                </div>

                {/* Estilos */}
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-widest">Estilos de conteúdo (até 3)</div>

                  <div className="flex flex-wrap gap-2">
                    {STYLE_OPTIONS.map((opt) => {
                      const active = form.content_styles.includes(opt);
                      const disabled = !active && form.content_styles.length >= 3;

                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleStyle(opt)}
                          className={`text-xs px-3 py-2 rounded-full border transition ${
                            active
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-border/50 bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10"
                          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  <div className="text-[11px] text-muted-foreground">
                    Selecionados:{" "}
                    <span className="text-foreground font-medium">{form.content_styles.join(", ") || "—"}</span>
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

                <div className="text-xs text-muted-foreground">
                  * Por enquanto, audiência e métricas são informadas por você. No futuro, será integrada com dados reais (Meta).
                </div>
              </div>
            </div>
          </div>
        )}

        {ctx.error && <div className="text-xs text-muted-foreground">Erro ao carregar contexto premium: {String(ctx.error)}</div>}
      </div>
    </MobileLayout>
  );
}