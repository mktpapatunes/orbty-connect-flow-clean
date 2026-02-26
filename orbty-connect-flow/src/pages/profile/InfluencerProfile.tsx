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
  Sparkles,
  Camera,
  ExternalLink,
  Pencil,
  Shield,
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
    <div className={`rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur ${props.className ?? ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">{props.label}</div>
        {props.icon}
      </div>
      <div className="mt-2 text-xl font-semibold text-foreground">{props.value}</div>
    </div>
  );
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

/** Donut simples via SVG (sem lib) */
function DonutChart(props: {
  value: number; // 0..100
  label: string;
  sublabel?: string;
  captionLeft?: string;
  captionRight?: string;
}) {
  const v = clamp(props.value, 0, 100);

  // SVG circle params
  const size = 96;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (v / 100) * c;

  return (
    <div className="rounded-2xl border border-border/50 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{props.label}</div>
        <div className="text-[10px] px-2 py-1 rounded-full border border-border/50 bg-white/5 text-muted-foreground">
          donut
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div className="relative w-[96px] h-[96px]">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={stroke}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="rgba(59,130,246,0.85)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c - dash}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-lg font-semibold text-foreground">{Math.round(v)}%</div>
            {props.sublabel ? <div className="text-[10px] text-muted-foreground -mt-1">{props.sublabel}</div> : null}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {(props.captionLeft || props.captionRight) && (
            <div className="text-xs text-muted-foreground space-y-1">
              {props.captionLeft ? <div>{props.captionLeft}</div> : null}
              {props.captionRight ? <div>{props.captionRight}</div> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================
   Types (mínimos)
========================= */

type AudienceGenderObj = { female?: number; male?: number } | null;

type AudienceAgeObj = Record<string, number> | null; // ex: {"18-24": 30, "25-34": 40}

type AudienceCitiesObj = Record<string, number> | null; // ex: {"São Paulo": 50, "Rio": 20}

const AGE_BUCKETS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;

function parseObjectNumbers(v: any): Record<string, number> | null {
  if (!v || typeof v !== "object") return null;
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v)) {
    const num = Number(val);
    if (!Number.isNaN(num)) out[String(k)] = num;
  }
  return Object.keys(out).length ? out : null;
}

function topKeys(obj: Record<string, number> | null | undefined, top = 3) {
  if (!obj) return [];
  return Object.entries(obj)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, top)
    .map(([k]) => k);
}

function sumObj(obj: Record<string, number> | null | undefined) {
  if (!obj) return 0;
  return Object.values(obj).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

/* =========================
   Page
========================= */

export default function InfluencerProfile() {
  const navigate = useNavigate();
  const { profile, userRole, approvalStatus, refreshProfile } = useAuth();
  const ctx = useMyProfileContext();

  const isVerifiedInfluencer = userRole === "influencer" && approvalStatus === "approved";

  // Upload avatar
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
  const fallbackFollowers = useMemo(() => {
    const raw = (profile as any)?.followers as string | undefined;
    if (!raw) return null;
    const onlyDigits = raw.replace(/[^\d]/g, "");
    if (!onlyDigits) return null;
    const n = Number(onlyDigits);
    return Number.isFinite(n) ? n : null;
  }, [profile]);

  const fallbackGender = useMemo(() => {
    const ag = (profile as any)?.audience_gender as AudienceGenderObj;
    const female = typeof ag?.female === "number" ? ag.female : 50;
    const male = typeof ag?.male === "number" ? ag.male : 50;
    return { female, male };
  }, [profile]);

  const instagram = useMemo(() => {
    const rpcIg = (ctx.data as any)?.instagram;
    if (rpcIg) return rpcIg;

    return {
      platform: "instagram",
      source: "self_reported",
      instagram_username: (profile as any)?.instagram ?? null,
      followers_count: fallbackFollowers,
      audience_female_pct: fallbackGender.female,
      audience_male_pct: fallbackGender.male,
      audience_region: null,
      collected_at: null,
    };
  }, [ctx.data, profile, fallbackFollowers, fallbackGender]);

  // ✅ Audience extra (para o perfil completo, parecido com o público)
  // Preferência: campos do profiles (se você já criou) -> fallback ctx -> fallback vazio
  const audienceCities = useMemo<AudienceCitiesObj>(() => {
    const fromProfile = parseObjectNumbers((profile as any)?.audience_cities);
    if (fromProfile) return fromProfile;

    const fromCtx = parseObjectNumbers((ctx.data as any)?.audience_cities);
    return fromCtx || null;
  }, [profile, ctx.data]);

  const audienceAge = useMemo<AudienceAgeObj>(() => {
    const fromProfile = parseObjectNumbers((profile as any)?.audience_age);
    if (fromProfile) return fromProfile;

    const fromCtx = parseObjectNumbers((ctx.data as any)?.audience_age);
    return fromCtx || null;
  }, [profile, ctx.data]);

  const topCities = useMemo(() => topKeys(audienceCities, 4), [audienceCities]);
  const topAges = useMemo(() => {
    const merged: Record<string, number> = {};
    // garantir buckets fixos quando existir algo
    for (const k of AGE_BUCKETS) merged[k] = 0;

    if (audienceAge) {
      for (const [k, v] of Object.entries(audienceAge)) {
        merged[k] = (merged[k] ?? 0) + (Number.isFinite(v) ? v : 0);
      }
    }

    const total = sumObj(merged);
    if (total <= 0) return topKeys(audienceAge, 3); // fallback se vier só alguns buckets

    return Object.entries(merged)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .slice(0, 3)
      .map(([k]) => k);
  }, [audienceAge]);

  // Orbty metrics (sucesso)
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
        const total = Number(rpcMetrics.total_applications ?? 0);
        const accepted = Number(rpcMetrics.accepted_applications ?? 0);
        setOrbtyTotal(total);
        setOrbtyAccepted(accepted);
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
      const total = list.length;
      const accepted = list.filter((x: any) => x.status === "accepted").length;

      setOrbtyTotal(total);
      setOrbtyAccepted(accepted);
      setLoadingOrbty(false);
    })();

    return () => {
      alive = false;
    };
  }, [profile?.id, ctx.data]);

  // Modal: Atualizar IG (mantém o que você já tinha)
  const [igOpen, setIgOpen] = useState(false);
  const [igSaving, setIgSaving] = useState(false);

  const [igForm, setIgForm] = useState(() => ({
    instagram_username: (profile as any)?.instagram ?? "",
    followers_count: instagram?.followers_count ?? 0,
    audience_female_pct: Number(instagram?.audience_female_pct ?? 50), // ✅ feminino
    audience_male_pct: Number(instagram?.audience_male_pct ?? 50), // ✅ masculino (fica sincronizado)
    audience_region: instagram?.audience_region ?? "",
  }));

  useEffect(() => {
    if (!igOpen) return;
    setIgForm({
      instagram_username: (profile as any)?.instagram ?? "",
      followers_count: instagram?.followers_count ?? 0,
      audience_female_pct: Number(instagram?.audience_female_pct ?? 50),
      audience_male_pct: Number(instagram?.audience_male_pct ?? 50),
      audience_region: instagram?.audience_region ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [igOpen]);

  const handleSaveIg = async () => {
    const female = clamp(Number(igForm.audience_female_pct ?? 0), 0, 100);
    const male = clamp(Number(igForm.audience_male_pct ?? 0), 0, 100);

    // normaliza pra 100 (se usuário mexer manualmente no futuro)
    const total = female + male;
    const nf = total > 0 ? (female / total) * 100 : 50;
    const nm = total > 0 ? (male / total) * 100 : 50;

    if (igForm.followers_count < 0) {
      toast.error("Seguidores inválido.");
      return;
    }

    setIgSaving(true);
    try {
      await updateMyInstagramStats({
        instagram_username: igForm.instagram_username,
        followers_count: igForm.followers_count,
        audience_female_pct: nf,
        audience_male_pct: nm,
        audience_region: igForm.audience_region || undefined,
      });

      toast.success("Métricas do Instagram atualizadas!");
      setIgOpen(false);

      await ctx.refetch();
      await refreshProfile();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar métricas.");
    } finally {
      setIgSaving(false);
    }
  };

  const navType = "influencer";

  const followersLabel =
    instagram?.followers_count === null || instagram?.followers_count === undefined
      ? "—"
      : Number(instagram.followers_count).toLocaleString("pt-BR");

  const igHandle = (profile as any)?.instagram ?? null;
  const igRaw = buildInstagramLinks(igHandle)?.raw ?? null;

  const locationLabel = profile ? `${profile.city}, ${profile.state}` : "—";

  const femalePct = Number(instagram?.audience_female_pct ?? 50);
  const malePct = Number(instagram?.audience_male_pct ?? (100 - femalePct));

  const successRate = useMemo(() => {
    if (!orbtyTotal) return 0;
    return (orbtyAccepted / orbtyTotal) * 100;
  }, [orbtyAccepted, orbtyTotal]);

  return (
    <MobileLayout title="Meu perfil" showBack navType={navType}>
      <div className="px-6 py-6 space-y-6">
        {/* HERO (igual vibe do perfil público) */}
        <GlassCard className="p-5">
          <div className="flex items-start justify-between gap-4">
            {/* avatar + infos */}
            <div className="flex items-start gap-3 min-w-0">
              <div className="relative shrink-0">
                <div className="w-14 h-14 rounded-2xl overflow-hidden border border-primary/20 bg-white/5 flex items-center justify-center">
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

                <button
                  type="button"
                  onClick={handlePickAvatar}
                  disabled={avatarUploading}
                  className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary flex items-center justify-center disabled:opacity-60"
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

              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  {/* ✅ Nome sem truncar agressivo */}
                  <div className="text-lg font-semibold text-foreground break-words leading-tight">
                    {profile?.name || "Creator"}
                  </div>
                  {isVerifiedInfluencer && <VerifiedBadge size="sm" />}
                </div>

                {/* Instagram clicável */}
                <div className="mt-1 text-sm text-muted-foreground flex items-center gap-2">
                  <Instagram className="w-4 h-4" />
                  {igRaw ? (
                    <button
                      onClick={() => openInstagram(igHandle)}
                      className="inline-flex items-center gap-1 text-primary hover:opacity-90 transition-opacity"
                      title="Abrir Instagram"
                    >
                      <span>@{igRaw}</span>
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  ) : (
                    <span>Instagram não informado</span>
                  )}
                </div>

                <div className="mt-1 text-sm text-muted-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span className="truncate">{locationLabel}</span>
                </div>
              </div>
            </div>

            {/* ações */}
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => navigate("/perfil-influenciadora/editar")}
                className="rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition flex items-center gap-2"
              >
                <Pencil className="w-4 h-4 text-primary" />
                Editar perfil
              </button>

              <button
                onClick={() => navigate("/perfil-influenciadora/dados-pessoais")}
                className="rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition flex items-center gap-2"
              >
                <Shield className="w-4 h-4 text-primary" />
                Dados pessoais
              </button>

              <button
                onClick={() => setIgOpen(true)}
                className="rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-primary" />
                Atualizar IG
              </button>
            </div>
          </div>
        </GlassCard>

        {/* QUICK CARDS (mesma lógica do público) */}
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => openInstagram(igHandle)}
            disabled={!igRaw}
            className={`rounded-2xl border p-3 text-left transition ${
              igRaw ? "border-border/50 bg-white/5 hover:bg-white/10" : "border-border/30 bg-white/5 opacity-60"
            }`}
          >
            <div className="flex items-center justify-between">
              <Instagram className="w-4 h-4 text-primary" />
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Instagram</p>
            <p className="text-sm font-semibold text-foreground truncate">{igRaw ? `@${igRaw}` : "—"}</p>
          </button>

          <div className="rounded-2xl border border-border/50 bg-white/5 p-3 text-left">
            <div className="flex items-center justify-between">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-white/5 text-muted-foreground">
                público
              </span>
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Seguidores</p>
            <p className="text-sm font-semibold text-foreground truncate">{followersLabel}</p>
          </div>

          <button
            type="button"
            onClick={() => {
              const q = encodeURIComponent(locationLabel);
              window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener,noreferrer");
            }}
            className="rounded-2xl border border-border/50 bg-white/5 hover:bg-white/10 p-3 text-left transition"
          >
            <div className="flex items-center justify-between">
              <MapPin className="w-4 h-4 text-primary" />
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Localização</p>
            <p className="text-sm font-semibold text-foreground truncate">{profile?.city || "—"}</p>
          </button>
        </div>

        {/* AUDIÊNCIA (premium) */}
        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">Audiência</div>
              <div className="text-xs text-muted-foreground">Dados informados por você (por enquanto)</div>
            </div>
            <button
              onClick={() => navigate("/perfil-influenciadora/editar")}
              className="text-xs px-3 py-2 rounded-xl border border-border/50 bg-white/5 hover:bg-white/10 transition text-muted-foreground hover:text-foreground"
              title="Editar audiência no editar perfil"
            >
              Editar
            </button>
          </div>

          {/* Donuts: Gênero */}
          <div className="grid grid-cols-1 gap-3">
            <DonutChart
              value={femalePct}
              label="Gênero"
              sublabel="Feminino"
              captionLeft={`Feminino: ${Math.round(femalePct)}%`}
              captionRight={`Masculino: ${Math.round(malePct)}%`}
            />
          </div>

          {/* Top Faixas etárias (chips) */}
          <div className="rounded-2xl border border-border/50 bg-white/5 p-4">
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
                    className="text-xs px-3 py-2 rounded-full border border-border/50 bg-white/5 text-foreground"
                  >
                    {age}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Top Cidades (somente nomes) */}
          <div className="rounded-2xl border border-border/50 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Principais cidades</div>
              <div className="text-[10px] px-2 py-1 rounded-full border border-border/50 bg-white/5 text-muted-foreground">
                top
              </div>
            </div>

            {topCities.length === 0 ? (
              <div className="mt-3 text-sm text-muted-foreground">Sem dados de cidades.</div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {topCities.map((city) => (
                  <span
                    key={city}
                    className="text-xs px-3 py-2 rounded-full border border-border/50 bg-white/5 text-foreground"
                  >
                    {city}
                  </span>
                ))}
              </div>
            )}
          </div>
        </GlassCard>

        {/* PERFORMANCE ORBTY (somente sucesso) */}
        <GlassCard className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">Performance na Orbty</div>
              <div className="text-xs text-muted-foreground">Participações com sucesso</div>
            </div>
          </div>

          {loadingOrbty ? (
            <div className="flex justify-center py-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Aceites" value={orbtyAccepted} />
              <MetricCard label="Taxa de sucesso" value={`${Math.round(successRate)}%`} />
            </div>
          )}
        </GlassCard>

        {/* Modal Atualizar IG (mantido) */}
        {igOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => (igSaving ? null : setIgOpen(false))} />
            <div className="relative w-full md:max-w-md rounded-t-3xl md:rounded-3xl border border-border/50 bg-background p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">Atualizar métricas do Instagram</div>
                <button className="p-2 rounded-xl hover:bg-white/5" onClick={() => (igSaving ? null : setIgOpen(false))}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">@instagram</Label>
                  <Input
                    value={igForm.instagram_username}
                    onChange={(e) => setIgForm((s) => ({ ...s, instagram_username: e.target.value }))}
                    placeholder="@seuinstagram"
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Seguidores</Label>
                  <Input
                    type="number"
                    min={0}
                    value={igForm.followers_count}
                    onChange={(e) => setIgForm((s) => ({ ...s, followers_count: Number(e.target.value || 0) }))}
                    className="text-sm"
                  />
                </div>

                {/* ✅ agora 2 campos (feminino e masculino) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Feminino (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={igForm.audience_female_pct}
                      onChange={(e) => setIgForm((s) => ({ ...s, audience_female_pct: Number(e.target.value || 0) }))}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Masculino (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={igForm.audience_male_pct}
                      onChange={(e) => setIgForm((s) => ({ ...s, audience_male_pct: Number(e.target.value || 0) }))}
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* slider opcional: controla feminino e ajusta masculino automático */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Ajuste rápido (Feminino)</Label>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Feminino: {clamp(Number(igForm.audience_female_pct || 0), 0, 100)}%</span>
                    <span>Masculino: {clamp(Number(igForm.audience_male_pct || 0), 0, 100)}%</span>
                  </div>
                  <Slider
                    value={[clamp(Number(igForm.audience_female_pct || 0), 0, 100)]}
                    onValueChange={(v) => {
                      const female = clamp(v[0], 0, 100);
                      const male = clamp(100 - female, 0, 100);
                      setIgForm((s) => ({ ...s, audience_female_pct: female, audience_male_pct: male }));
                    }}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Região do público</Label>
                  <Input
                    value={igForm.audience_region}
                    onChange={(e) => setIgForm((s) => ({ ...s, audience_region: e.target.value }))}
                    placeholder="Ex: São Paulo - SP"
                    className="text-sm"
                  />
                </div>

                <button
                  onClick={handleSaveIg}
                  disabled={igSaving}
                  className="w-full py-3 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-sm glow-blue flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {igSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {igSaving ? "Salvando..." : "Salvar"}
                </button>

                <div className="text-xs text-muted-foreground">
                  * Por enquanto, as métricas são informadas por você. No futuro, elas poderão ser verificadas via integração Meta.
                </div>
              </div>
            </div>
          </div>
        )}

        {ctx.error && <div className="text-xs text-muted-foreground">Erro ao carregar contexto premium: {ctx.error}</div>}
      </div>
    </MobileLayout>
  );
}