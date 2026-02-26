import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Instagram,
  MapPin,
  Loader2,
  Users,
  Sparkles,
  ShieldCheck,
  BadgeCheck,
  Hourglass,
  XCircle,
} from "lucide-react";

type PublicProfileRow = {
  id: string;
  name: string;
  city: string;
  state: string;
  bio: string | null;
  avatar_url: string | null;
  instagram: string | null;
  followers: string | null;
  audience_gender: any | null;
  desired_role: "contractor" | "influencer" | "admin" | null;
  approval_status?: "pending" | "approved" | "rejected";
};

function GlassCard(props: { children: React.ReactNode; className?: string }) {
  return <div className={`glass-card p-5 ${props.className ?? ""}`}>{props.children}</div>;
}

function formatFollowers(value: string | null | undefined) {
  if (!value) return null;
  const onlyDigits = String(value).replace(/[^\d]/g, "");
  if (!onlyDigits) return null;
  const n = Number(onlyDigits);
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString("pt-BR");
}

function normalizeAt(handle?: string | null) {
  const h = (handle || "").trim();
  if (!h) return null;
  return h.startsWith("@") ? h : `@${h}`;
}

function toInstagramUrl(handle?: string | null) {
  const at = normalizeAt(handle);
  if (!at) return null;
  const username = at.replace("@", "").trim();
  if (!username) return null;
  return `https://instagram.com/${username}`;
}

function clampPct(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function DonutChart(props: { label: string; valuePct: number; subLabel?: string }) {
  // SVG donut (sem libs)
  const size = 92;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = clampPct(props.valuePct, 0);
  const dash = (pct / 100) * c;

  return (
    <div className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="stroke-border/40"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="stroke-primary"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: 16, fontWeight: 700 }}
        >
          {pct.toFixed(0)}%
        </text>
      </svg>

      <div className="min-w-0">
        <div className="text-sm font-semibold text-foreground">{props.label}</div>
        <div className="text-xs text-muted-foreground mt-1">{props.subLabel ?? "Distribuição estimada"}</div>
      </div>
    </div>
  );
}

function MetricMini(props: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">{props.label}</div>
        {props.icon}
      </div>
      <div className="mt-2 text-xl font-semibold text-foreground">{props.value}</div>
    </div>
  );
}

export default function PublicUserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProfileRow | null>(null);

  const [orbtyStats, setOrbtyStats] = useState<{
    total: number;
    accepted: number;
    pending: number;
    rejected: number;
  } | null>(null);
  const [orbtyLoading, setOrbtyLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!id) {
        setLoading(false);
        setProfile(null);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id,name,city,state,bio,avatar_url,instagram,followers,audience_gender,desired_role,approval_status")
          .eq("id", id)
          .maybeSingle();

        if (!alive) return;

        if (error) {
          console.error("PUBLIC_PROFILE_FETCH_ERROR", error);
          toast.error("Erro ao carregar perfil.");
          setProfile(null);
          setLoading(false);
          return;
        }

        setProfile((data as any) ?? null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  // Métricas públicas (best-effort)
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!id) return;
      setOrbtyLoading(true);

      try {
        // ⚠️ Pode depender das suas policies.
        // Se der erro, só não exibe as métricas.
        const { data, error } = await supabase
          .from("campaign_applications")
          .select("status")
          .eq("influencer_id", id);

        if (!alive) return;

        if (error) {
          console.warn("PUBLIC_ORBTY_STATS_BLOCKED_OR_ERROR", error);
          setOrbtyStats(null);
          return;
        }

        const list = (data ?? []) as any[];
        const total = list.length;
        const accepted = list.filter((x) => x.status === "accepted").length;
        const pending = list.filter((x) => x.status === "pending").length;
        const rejected = list.filter((x) => x.status === "rejected").length;

        setOrbtyStats({ total, accepted, pending, rejected });
      } finally {
        if (alive) setOrbtyLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const at = useMemo(() => normalizeAt(profile?.instagram ?? null), [profile?.instagram]);
  const igUrl = useMemo(() => toInstagramUrl(profile?.instagram ?? null), [profile?.instagram]);

  const followers = useMemo(() => {
    const fromFollowers = formatFollowers(profile?.followers ?? null);
    return fromFollowers;
  }, [profile?.followers]);

  const audience = useMemo(() => {
    const ag = profile?.audience_gender ?? null;
    const female = clampPct(ag?.female, 50);
    const male = clampPct(ag?.male, 100 - female);
    // normaliza soma se vier quebrado
    const sum = female + male;
    if (sum === 0) return { female: 50, male: 50 };
    if (Math.abs(sum - 100) < 0.01) return { female, male };
    // reescala mantendo proporção
    const f = (female / sum) * 100;
    const m = 100 - f;
    return { female: f, male: m };
  }, [profile?.audience_gender]);

  const roleLabel =
    profile?.desired_role === "influencer"
      ? "Creator"
      : profile?.desired_role === "contractor"
        ? "Negócio"
        : "Usuário";

  const backTo = "/welcome"; // fallback
  const navType = "contractor"; // não importa aqui, mas MobileLayout pede; vamos neutralizar com showNav false

  if (loading) {
    return (
      <MobileLayout title="Perfil" showBack navType={navType} showNav={false} backTo={backTo}>
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  if (!profile) {
    return (
      <MobileLayout title="Perfil" showBack navType={navType} showNav={false} backTo={backTo}>
        <div className="px-6 py-16 text-center">
          <p className="text-muted-foreground">Perfil não encontrado.</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border/50 bg-card/60 text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Perfil público" showBack navType={navType} showNav={false} backTo={backTo}>
      <div className="px-6 py-6 space-y-6">
        {/* Header premium */}
        <GlassCard>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              {/* ✅ Avatar corrigido (não quebra) */}
              <div className="w-16 h-16 rounded-full overflow-hidden border border-primary/25 bg-white/5 shrink-0">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="w-full h-full object-cover object-center"
                  />
                ) : (
                  <div className="w-full h-full bg-white/5" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-lg font-semibold text-foreground truncate">{profile.name}</div>

                  {/* selo simples */}
                  {profile.approval_status === "approved" && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border border-border/50 bg-card/60 text-muted-foreground">
                      <ShieldCheck className="w-3 h-3 text-accent" />
                      Verificado
                    </span>
                  )}

                  <span className="text-[10px] px-2 py-1 rounded-full border border-border/50 bg-card/60 text-muted-foreground">
                    {roleLabel}
                  </span>
                </div>

                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span className="truncate">
                    {profile.city}, {profile.state}
                  </span>
                </div>

                {/* @ clicável */}
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <Instagram className="w-4 h-4 text-muted-foreground" />
                  {igUrl ? (
                    <a
                      href={igUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline underline-offset-4 hover:opacity-80 truncate"
                      title="Abrir Instagram"
                    >
                      {at}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Instagram não informado</span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate(-1)}
              className="shrink-0 rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition flex items-center gap-2"
              title="Voltar"
            >
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              Voltar
            </button>
          </div>

          {profile.bio && (
            <p className="mt-4 text-sm text-foreground/70 leading-relaxed">{profile.bio}</p>
          )}
        </GlassCard>

        {/* Seguidores em destaque (estilo insights) */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-widest">Seguidores</div>
              <div className="mt-1 text-4xl font-bold text-foreground">
                {followers ?? "—"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Base informada pelo perfil
              </div>
            </div>

            <div className="w-12 h-12 rounded-2xl bg-gradient-neon-subtle flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
          </div>
        </GlassCard>

        {/* Donuts */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <div className="text-xs text-muted-foreground uppercase tracking-widest">Público (gênero)</div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <DonutChart label="Público feminino" valuePct={audience.female} subLabel="Percentual estimado" />
            <DonutChart label="Público masculino" valuePct={audience.male} subLabel="Percentual estimado" />
          </div>
        </div>

        {/* Performance Orbty */}
        <GlassCard className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">Performance na Orbty</div>
            <span className="text-[10px] px-2 py-1 rounded-full border border-border/50 bg-card/60 text-muted-foreground">
              público
            </span>
          </div>

          {orbtyLoading ? (
            <div className="flex justify-center py-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            </div>
          ) : orbtyStats ? (
            <div className="grid grid-cols-2 gap-3">
              <MetricMini label="Candidaturas" value={orbtyStats.total} icon={<Users className="w-4 h-4 text-primary" />} />
              <MetricMini label="Aceitas" value={orbtyStats.accepted} icon={<BadgeCheck className="w-4 h-4 text-accent" />} />
              <MetricMini label="Pendentes" value={orbtyStats.pending} icon={<Hourglass className="w-4 h-4 text-warning" />} />
              <MetricMini label="Rejeitadas" value={orbtyStats.rejected} icon={<XCircle className="w-4 h-4 text-muted-foreground" />} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Métricas indisponíveis no momento (pode depender das policies do banco).
            </p>
          )}
        </GlassCard>

        <div className="text-[11px] text-muted-foreground">
          * Este é o perfil público visual. Dados pessoais (telefone, endereço, etc) ficam no perfil interno do usuário.
        </div>
      </div>
    </MobileLayout>
  );
}