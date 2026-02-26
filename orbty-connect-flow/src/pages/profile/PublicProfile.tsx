import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import VerifiedBadge from "@/components/VerifiedBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ExternalLink,
  Loader2,
  MapPin,
  Instagram,
  Users,
  BarChart3,
  Sparkles,
  Briefcase,
  Megaphone,
  CheckCircle2,
  Hourglass,
  XCircle,
} from "lucide-react";

type PublicProfileRow = {
  id: string;
  name: string;
  city: string;
  state: string;
  avatar_url: string | null;
  instagram: string | null;
  followers: string | null;
  audience_gender: any | null;
  bio: string | null;
  content_style: string | null;
  approval_status?: "pending" | "approved" | "rejected";
  desired_role?: "admin" | "contractor" | "influencer" | null;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function formatCompactNumber(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(".", ",")}k`;
  return String(value);
}

function parseFollowersFromProfile(p?: PublicProfileRow | null) {
  const raw = (p?.followers || "").trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
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

  // tenta abrir app (mobile) e faz fallback web
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

function InsightCard(props: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">{props.title}</p>
        {props.right}
      </div>
      {props.children}
    </div>
  );
}

function Avatar({
  src,
  alt,
  size = 64,
}: {
  src?: string | null;
  alt: string;
  size?: number;
}) {
  const initials = alt
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div
      className="rounded-full overflow-hidden bg-white/5 border border-border/50 shrink-0"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover block"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "";
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-muted-foreground">
          {initials || "@"}
        </div>
      )}
    </div>
  );
}

function ProgressRow({ label, value, pct }: { label: string; value: string; pct: number }) {
  const p = clamp01(pct);
  return (
    <div className="space-y-1">
      <div className="flex items-end justify-between gap-3">
        <span className="text-xs text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground shrink-0">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-border/40 overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${p * 100}%` }} />
      </div>
    </div>
  );
}

function Donut({ value, label, sublabel }: { value: number; label: string; sublabel?: string }) {
  const v = clamp01(value);
  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = c * v;
  const gap = c - dash;

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-[70px] h-[70px]">
        <svg viewBox="0 0 80 80" className="w-full h-full">
          <circle cx="40" cy="40" r={r} stroke="currentColor" strokeWidth="8" fill="none" className="text-border/40" />
          <circle
            cx="40"
            cy="40"
            r={r}
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            className="text-primary"
            strokeDasharray={`${dash} ${gap}`}
            transform="rotate(-90 40 40)"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-semibold text-foreground">{Math.round(v * 100)}%</span>
        </div>
      </div>

      <div className="min-w-0">
        <div className="text-sm font-semibold text-foreground">{label}</div>
        {sublabel && <div className="text-xs text-muted-foreground">{sublabel}</div>}
      </div>
    </div>
  );
}

type TabKey = "visao" | "insights" | "orbty";

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile: myProfile, userRole, approvalStatus, isAdmin } = useAuth();

  const [tab, setTab] = useState<TabKey>("visao");
  const [loading, setLoading] = useState(true);
  const [p, setP] = useState<PublicProfileRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // stats públicos (best-effort; se RLS bloquear, fica “—”)
  const [orbtyStats, setOrbtyStats] = useState<{
    influencer?: { total: number; accepted: number; pending: number; rejected: number };
    contractor?: { total: number; active: number; completed: number; closed: number };
  }>({});

  const isMe = !!(myProfile?.id && id && myProfile.id === id);

  const roleGuess = useMemo(() => {
    const desired = (p as any)?.desired_role as "contractor" | "influencer" | "admin" | undefined;
    if (desired === "contractor" || desired === "influencer" || desired === "admin") return desired;
    // fallback: se não tem desired_role, tenta inferir pela presença de followers/instagram (bem leve)
    const hasFollowers = !!p?.followers;
    return hasFollowers ? "influencer" : "contractor";
  }, [p]);

  const isVerified = useMemo(() => {
    // público: só mostra verificado se approved
    return (p as any)?.approval_status === "approved";
  }, [p]);

  const instagramHandle = useMemo(() => {
    const raw = (p?.instagram || "").trim();
    return raw || null;
  }, [p]);

  const followersCount = useMemo(() => {
    const n = parseFollowersFromProfile(p);
    return n;
  }, [p]);

  const genderSplit = useMemo(() => {
    // audience_gender pode ser {female: number, male: number}
    const ag = p?.audience_gender as any;
    const female = typeof ag?.female === "number" ? ag.female : 50;
    const male = typeof ag?.male === "number" ? ag.male : 50;
    const sum = female + male || 100;
    return {
      femalePct: Math.round((female / sum) * 100),
      malePct: Math.round((male / sum) * 100),
    };
  }, [p]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!id) return;

      setLoading(true);
      setError(null);
      setP(null);

      try {
        // ✅ IMPORTANT: seleciona apenas campos públicos (não traz phone/email)
        const { data, error } = await supabase
          .from("profiles")
          .select("id,name,city,state,avatar_url,instagram,followers,audience_gender,bio,content_style,approval_status,desired_role")
          .eq("id", id)
          .maybeSingle();

        if (!alive) return;

        if (error) {
          console.error("PUBLIC_PROFILE_SELECT_ERROR", error);
          setError("Não foi possível carregar o perfil.");
          setLoading(false);
          return;
        }

        if (!data) {
          setError("Perfil não encontrado.");
          setLoading(false);
          return;
        }

        setP(data as unknown as PublicProfileRow);
      } catch (e) {
        console.error("PUBLIC_PROFILE_EXCEPTION", e);
        if (alive) setError("Erro ao carregar perfil.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!id) return;
      if (!p) return;

      // best-effort: métricas públicas
      // Influencer: campanhas aplicadas (por status)
      // Contractor: campanhas criadas (por status)
      try {
        if (roleGuess === "influencer") {
          const { data, error } = await supabase
            .from("campaign_applications")
            .select("status")
            .eq("influencer_id", id);

          if (!alive) return;
          if (error) {
            console.warn("PUBLIC_INFLUENCER_ORBTY_STATS_BLOCKED", error);
            setOrbtyStats((s) => ({
              ...s,
              influencer: { total: 0, accepted: 0, pending: 0, rejected: 0 },
            }));
            return;
          }

          const list = (data || []) as any[];
          const total = list.length;
          const accepted = list.filter((x) => x.status === "accepted").length;
          const pending = list.filter((x) => x.status === "pending").length;
          const rejected = list.filter((x) => x.status === "rejected").length;

          setOrbtyStats((s) => ({ ...s, influencer: { total, accepted, pending, rejected } }));
        } else if (roleGuess === "contractor") {
          const { data, error } = await supabase
            .from("campaigns")
            .select("status")
            .eq("created_by", id);

          if (!alive) return;
          if (error) {
            console.warn("PUBLIC_CONTRACTOR_ORBTY_STATS_BLOCKED", error);
            setOrbtyStats((s) => ({
              ...s,
              contractor: { total: 0, active: 0, completed: 0, closed: 0 },
            }));
            return;
          }

          const list = (data || []) as any[];
          const total = list.length;
          const active = list.filter((x) => x.status === "active").length;
          const completed = list.filter((x) => x.status === "completed").length;
          const closed = list.filter((x) => x.status === "closed_manual" || x.status === "closed_expired").length;

          setOrbtyStats((s) => ({ ...s, contractor: { total, active, completed, closed } }));
        }
      } catch (e) {
        console.warn("PUBLIC_ORBTY_STATS_EXCEPTION", e);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id, p, roleGuess]);

  const headerTitle = roleGuess === "influencer" ? "Perfil da creator" : "Perfil do negócio";

  const navType = useMemo(() => {
    // mantém a navegação do usuário logado (não do perfil aberto)
    if (isAdmin) return "contractor";
    if (userRole === "influencer") return "influencer";
    return "contractor";
  }, [isAdmin, userRole]);

  if (loading) {
    return (
      <MobileLayout title={headerTitle} showBack navType={navType as any}>
        <div className="px-6 py-10 flex justify-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  if (error || !p) {
    return (
      <MobileLayout title={headerTitle} showBack navType={navType as any}>
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">{error || "Erro ao carregar."}</p>
        </div>
      </MobileLayout>
    );
  }

  const location = p.city && p.state ? `${p.city}, ${p.state}` : "—";

  const influencerStats = orbtyStats.influencer;
  const contractorStats = orbtyStats.contractor;

  const tabs: { key: TabKey; label: string }[] = [
    { key: "visao", label: "Visão" },
    { key: "insights", label: "Insights" },
    { key: "orbty", label: "Orbty" },
  ];

  return (
    <MobileLayout title={headerTitle} showBack navType={navType as any}>
      <div className="px-6 py-6 space-y-6">
        {/* Header premium */}
        <div className="glass-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar src={p.avatar_url} alt={p.name || "Perfil"} size={64} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold text-foreground truncate">{p.name || "—"}</div>
                  {isVerified && <VerifiedBadge size="sm" />}
                </div>

                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{location}</span>
                </div>

                <div className="mt-1">
                  {buildInstagramLinks(instagramHandle)?.raw ? (
                    <button
                      onClick={() => openInstagram(instagramHandle)}
                      className="inline-flex items-center gap-2 text-sm text-primary hover:opacity-90 transition-opacity"
                      title="Abrir Instagram"
                    >
                      <Instagram className="w-4 h-4" />
                      <span className="font-medium">@{buildInstagramLinks(instagramHandle)!.raw}</span>
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  ) : (
                    <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
                      <Instagram className="w-4 h-4" />
                      Instagram não informado
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* número principal em destaque (estilo Insights) */}
            <div className="text-right shrink-0">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                {roleGuess === "influencer" ? "Seguidores" : "Campanhas"}
              </div>

              <div className="font-display text-2xl font-extrabold text-foreground leading-none">
                {roleGuess === "influencer"
                  ? followersCount !== null
                    ? formatCompactNumber(followersCount)
                    : "—"
                  : contractorStats
                    ? formatCompactNumber(contractorStats.total)
                    : "—"}
              </div>

              <div className="text-[11px] text-muted-foreground mt-1">
                {roleGuess === "influencer" ? "no Instagram" : "na Orbty"}
              </div>
            </div>
          </div>

          {p.bio ? (
            <div className="mt-4 text-sm text-muted-foreground leading-relaxed">
              {p.bio}
            </div>
          ) : null}

          {/* CTA se for o próprio usuário */}
          {isMe ? (
            <button
              onClick={() => navigate("/perfil", { replace: false })}
              className="mt-4 w-full py-3 rounded-xl border border-border/50 bg-white/5 hover:bg-white/10 transition text-sm font-semibold text-foreground"
            >
              Editar meu perfil (interno)
            </button>
          ) : null}
        </div>

        {/* Tabs (chips estilo Insights) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                tab === t.key
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-card text-muted-foreground border border-border/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "visao" && (
          <div className="space-y-6">
            <InsightCard
              title="Resumo"
              right={
                <span className="text-[10px] text-muted-foreground">
                  {roleGuess === "influencer" ? (
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      Creator
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-primary" />
                      Negócio
                    </span>
                  )}
                </span>
              }
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">Região</div>
                    <MapPin className="w-4 h-4 text-accent" />
                  </div>
                  <div className="mt-2 text-xl font-semibold text-foreground">{location}</div>
                </div>

                <div className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">
                      {roleGuess === "influencer" ? "Conteúdo" : "Atuação"}
                    </div>
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div className="mt-2 text-xl font-semibold text-foreground">
                    {p.content_style || "—"}
                  </div>
                </div>
              </div>
            </InsightCard>

            <InsightCard title="Destaques">
              {roleGuess === "influencer" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">Seguidores</div>
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div className="mt-2 text-xl font-semibold text-foreground">
                      {followersCount !== null ? Number(followersCount).toLocaleString("pt-BR") : "—"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">Gênero (público)</div>
                      <BarChart3 className="w-4 h-4 text-primary" />
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      Feminino: <b className="text-foreground">{genderSplit.femalePct}%</b> · Masculino:{" "}
                      <b className="text-foreground">{genderSplit.malePct}%</b>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">Campanhas (total)</div>
                      <Megaphone className="w-4 h-4 text-primary" />
                    </div>
                    <div className="mt-2 text-xl font-semibold text-foreground">
                      {contractorStats ? contractorStats.total : "—"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">Ativas</div>
                      <CheckCircle2 className="w-4 h-4 text-accent" />
                    </div>
                    <div className="mt-2 text-xl font-semibold text-foreground">
                      {contractorStats ? contractorStats.active : "—"}
                    </div>
                  </div>
                </div>
              )}
            </InsightCard>
          </div>
        )}

        {tab === "insights" && (
          <div className="space-y-6">
            {roleGuess === "influencer" ? (
              <>
                <InsightCard title="Audiência">
                  <div className="space-y-4">
                    <Donut
                      value={genderSplit.femalePct / 100}
                      label="Público feminino"
                      sublabel={`Masculino: ${genderSplit.malePct}%`}
                    />

                    <div className="space-y-3">
                      <ProgressRow label="Feminino" value={`${genderSplit.femalePct}%`} pct={genderSplit.femalePct / 100} />
                      <ProgressRow label="Masculino" value={`${genderSplit.malePct}%`} pct={genderSplit.malePct / 100} />
                    </div>

                    <div className="text-xs text-muted-foreground">
                      * Por enquanto, os insights são informados no perfil interno.
                    </div>
                  </div>
                </InsightCard>

                <InsightCard title="Instagram">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-muted-foreground">Seguidores</div>
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <div className="mt-2 text-xl font-semibold text-foreground">
                        {followersCount !== null ? Number(followersCount).toLocaleString("pt-BR") : "—"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-muted-foreground">@</div>
                        <Instagram className="w-4 h-4 text-primary" />
                      </div>
                      <div className="mt-2 text-sm font-semibold text-foreground truncate">
                        {buildInstagramLinks(instagramHandle)?.raw ? `@${buildInstagramLinks(instagramHandle)!.raw}` : "—"}
                      </div>
                    </div>
                  </div>
                </InsightCard>
              </>
            ) : (
              <InsightCard title="Insights do negócio">
                <div className="text-sm text-muted-foreground">
                  Aqui entram dados “públicos” do contratante (ex: segmento, campanhas, reputação, etc).
                  Quando você me mandar as tabelas de <b>organizations</b> e <b>reviews</b> tipadas (ou trechos),
                  eu deixo essa seção completa e com gráficos também.
                </div>
              </InsightCard>
            )}
          </div>
        )}

        {tab === "orbty" && (
          <div className="space-y-6">
            {roleGuess === "influencer" ? (
              <InsightCard title="Performance na Orbty">
                {!influencerStats ? (
                  <div className="text-sm text-muted-foreground">
                    Sem dados (ou bloqueado por permissão).  
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-muted-foreground">Candidaturas</div>
                        <BarChart3 className="w-4 h-4 text-primary" />
                      </div>
                      <div className="mt-2 text-xl font-semibold text-foreground">{influencerStats.total}</div>
                    </div>

                    <div className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-muted-foreground">Aceitas</div>
                        <CheckCircle2 className="w-4 h-4 text-accent" />
                      </div>
                      <div className="mt-2 text-xl font-semibold text-foreground">{influencerStats.accepted}</div>
                    </div>

                    <div className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-muted-foreground">Pendentes</div>
                        <Hourglass className="w-4 h-4 text-warning" />
                      </div>
                      <div className="mt-2 text-xl font-semibold text-foreground">{influencerStats.pending}</div>
                    </div>

                    <div className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-muted-foreground">Rejeitadas</div>
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="mt-2 text-xl font-semibold text-foreground">{influencerStats.rejected}</div>
                    </div>
                  </div>
                )}
              </InsightCard>
            ) : (
              <InsightCard title="Campanhas na Orbty">
                {!contractorStats ? (
                  <div className="text-sm text-muted-foreground">
                    Sem dados (ou bloqueado por permissão).  
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-muted-foreground">Total</div>
                        <Megaphone className="w-4 h-4 text-primary" />
                      </div>
                      <div className="mt-2 text-xl font-semibold text-foreground">{contractorStats.total}</div>
                    </div>

                    <div className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-muted-foreground">Ativas</div>
                        <CheckCircle2 className="w-4 h-4 text-accent" />
                      </div>
                      <div className="mt-2 text-xl font-semibold text-foreground">{contractorStats.active}</div>
                    </div>

                    <div className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-muted-foreground">Concluídas</div>
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      </div>
                      <div className="mt-2 text-xl font-semibold text-foreground">{contractorStats.completed}</div>
                    </div>

                    <div className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-muted-foreground">Encerradas</div>
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="mt-2 text-xl font-semibold text-foreground">{contractorStats.closed}</div>
                    </div>
                  </div>
                )}
              </InsightCard>
            )}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}