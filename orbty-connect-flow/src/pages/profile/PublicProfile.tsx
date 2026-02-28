import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import VerifiedBadge from "@/components/VerifiedBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft,
  Instagram,
  Loader2,
  MapPin,
  Users,
  Sparkles,
  ExternalLink,
  BarChart3,
  User as UserIcon,
} from "lucide-react";

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

  // opcional, só se existir
  approval_status?: string | null;
};

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

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

const sumObj = (obj: Record<string, number>) => Object.values(obj).reduce((a, b) => a + (Number(b) || 0), 0);

function Donut(props: { pct: number; label: string; sub?: string }) {
  const pct = clamp(props.pct, 0, 100);
  // SVG donut simples (sem libs)
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
          stroke="rgba(59,130,246,0.85)"
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

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, userRole } = useAuth();

  const isSelf = !!user?.id && !!id && user.id === id;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const backTo = userRole === "contractor" ? "/dashboard-contratante" : "/dashboard-influenciadora";

  useEffect(() => {
    let mounted = true;

    const fetchWithFallback = async () => {
      if (!id) {
        setLoading(false);
        setProfile(null);
        return;
      }

      setLoading(true);

      // tentativa “completa”
      const selectFull =
        "id, name, city, state, neighborhood, bio, avatar_url, instagram, followers, content_style, audience_gender, audience_age, audience_cities, approval_status";
      const selectSafe =
        "id, name, city, state, neighborhood, bio, avatar_url, instagram, followers, content_style, audience_gender, audience_age, audience_cities";

      // 1) tenta com approval_status (se existir)
      let data: any = null;

      const first = await supabase.from("profiles").select(selectFull).eq("id", id).maybeSingle();

      if (first.error) {
        const msg = (first.error.message || "").toLowerCase();
        const missingColumn = msg.includes("does not exist") || msg.includes("column") || msg.includes("42703");

        if (!missingColumn) {
          console.error("PUBLIC_PROFILE_FETCH_ERROR", first.error);
          if (mounted) {
            setProfile(null);
            setLoading(false);
          }
          return;
        }

        // 2) fallback sem approval_status
        const second = await supabase.from("profiles").select(selectSafe).eq("id", id).maybeSingle();
        if (second.error) {
          console.error("PUBLIC_PROFILE_FETCH_ERROR_2", second.error);
          if (mounted) {
            setProfile(null);
            setLoading(false);
          }
          return;
        }
        data = second.data;
      } else {
        data = first.data;
      }

      if (!mounted) return;

      if (!data) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // normalize cities array
      const cities: AudienceCityRow[] | null = Array.isArray((data as any).audience_cities)
        ? (data as any).audience_cities
            .map((r: any) => ({ city: String(r?.city ?? "").trim(), pct: clamp(Number(r?.pct ?? 0), 0, 100) }))
            .filter((r: any) => r.city)
            .slice(0, 6)
        : null;

      setProfile({
        ...(data as any),
        audience_cities: cities,
      });

      setLoading(false);
    };

    fetchWithFallback();

    return () => {
      mounted = false;
    };
  }, [id]);

  const igHandle = useMemo(() => normalizeInstagram(profile?.instagram), [profile?.instagram]);

  const followersLabel = useMemo(() => {
    const raw = String(profile?.followers ?? "").trim();
    if (!raw) return "—";
    const n = Number(raw.replace(/[^\d]/g, ""));
    return Number.isFinite(n) && n > 0 ? n.toLocaleString("pt-BR") : raw;
  }, [profile?.followers]);

  const styles = useMemo(() => normalizeStyles(profile?.content_style ?? null), [profile?.content_style]);

  const locationLabel = useMemo(() => {
    if (!profile) return "";
    const base = `${profile.city}, ${profile.state}`;
    if (profile.neighborhood) return `${profile.neighborhood} · ${base}`;
    return base;
  }, [profile]);

  const openInstagram = () => {
    if (!igHandle) return;
    window.open(`https://www.instagram.com/${igHandle}`, "_blank", "noopener,noreferrer");
  };

  const audienceGender = useMemo(() => {
    const g = profile?.audience_gender;
    if (!g) return null;
    const female = typeof g.female === "number" ? clamp(g.female, 0, 100) : null;
    const male = typeof g.male === "number" ? clamp(g.male, 0, 100) : null;
    if (female === null && male === null) return null;

    // se só tiver um, deriva o outro
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
    return entries.slice(0, 2);
  }, [profile?.audience_age]);

  const topCities = useMemo(() => {
    const c = profile?.audience_cities;
    if (!Array.isArray(c) || !c.length) return null;
    return c.slice(0, 5);
  }, [profile?.audience_cities]);

  const isVerifiedOrbty = useMemo(() => {
    // prioridade: coluna approval_status, se existir
    const s = String((profile as any)?.approval_status ?? "").toLowerCase();
    if (s === "approved") return true;

    // se for o próprio usuário, usa o auth status (quando é ele vendo seu próprio público)
    // (não quebra e dá consistência)
    return false;
  }, [profile]);

  return (
    <MobileLayout title="Perfil" showBack backTo={backTo} navType={userRole === "contractor" ? "contractor" : "influencer"} showNav={false} showHome={false}>
      <div className="px-6 py-6 space-y-4">
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
            {/* HERO */}
            <div className="glass-card p-4">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 overflow-hidden flex items-center justify-center shrink-0">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-primary font-bold">{initials(profile.name)}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-foreground break-words leading-tight">{profile.name}</h2>
                    {(isVerifiedOrbty || (isSelf && userRole === "influencer")) ? <VerifiedBadge size="sm" /> : null}
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="truncate">{locationLabel}</span>
                  </div>

                  {profile.bio ? (
                    <p className="mt-3 text-sm text-foreground/75 leading-relaxed">{profile.bio}</p>
                  ) : null}

                  {/* Se for o próprio usuário, CTA pra abrir perfil completo */}
                  {isSelf && (
                    <button
                      type="button"
                      onClick={() => navigate("/perfil-influenciadora")}
                      className="mt-3 inline-flex items-center gap-2 text-xs px-3 py-2 rounded-xl border border-border/50 bg-card/60 text-muted-foreground hover:text-foreground transition"
                    >
                      <UserIcon className="w-4 h-4" />
                      Abrir meu perfil
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* QUICK CARDS */}
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={openInstagram}
                disabled={!igHandle}
                className={`rounded-2xl border p-3 text-left transition ${
                  igHandle ? "border-border/50 bg-card/60 hover:bg-card/80" : "border-border/30 bg-card/40 opacity-70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Instagram className="w-4 h-4 text-primary" />
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Instagram</p>
                <p className="text-sm font-semibold text-foreground truncate">{igHandle ? `@${igHandle}` : "—"}</p>
              </button>

              <div className="rounded-2xl border border-border/50 bg-card/60 p-3 text-left">
                <div className="flex items-center justify-between">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-white/5 text-muted-foreground">
                    público
                  </span>
                </div>
                <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Seguidores</p>
                <p className="text-sm font-semibold text-foreground truncate">{followersLabel}</p>
              </div>

              <div className="rounded-2xl border border-border/50 bg-card/60 p-3 text-left">
                <div className="flex items-center justify-between">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-white/5 text-muted-foreground">
                    estilos
                  </span>
                </div>
                <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Conteúdo</p>
                <p className="text-sm font-semibold text-foreground truncate">{styles.length ? styles.join(", ") : "—"}</p>
              </div>
            </div>

            {/* AUDIÊNCIA PREMIUM */}
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-primary" />
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Audiência</p>
              </div>

              {!audienceGender && !topAge && !topCities ? (
                <p className="text-sm text-muted-foreground">Sem dados de audiência por enquanto.</p>
              ) : (
                <div className="space-y-3">
                  {/* Donuts gênero */}
                  {audienceGender && (
                    <div className="grid grid-cols-1 gap-3">
                      <Donut pct={audienceGender.female ?? 0} label="Feminino" sub="Distribuição por gênero" />
                      <Donut pct={audienceGender.male ?? 0} label="Masculino" sub="Distribuição por gênero" />
                    </div>
                  )}

                  {/* idade */}
                  {topAge && (
                    <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                      <div className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Faixa etária (top)</div>
                      <div className="space-y-2">
                        {topAge.map((x) => (
                          <div key={x.k} className="flex items-center justify-between text-sm">
                            <span className="text-foreground font-medium">{x.k}</span>
                            <span className="text-muted-foreground">{x.v.toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* cidades */}
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
          </>
        )}
      </div>
    </MobileLayout>
  );
}