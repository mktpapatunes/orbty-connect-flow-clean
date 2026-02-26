import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import VerifiedBadge from "@/components/VerifiedBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Instagram,
  Loader2,
  MapPin,
  Users,
  ExternalLink,
  BarChart3,
  Sparkles,
  Info,
  ShieldCheck, // ✅ ADD
} from "lucide-react";
import { PieChart, Pie, ResponsiveContainer, Tooltip, Cell } from "recharts";

/**
 * ✅ AJUSTE AQUI se sua rota do "Meu perfil" for diferente.
 * Exemplos comuns: "/influencer-profile", "/perfil-influenciadora", "/meu-perfil"
 */
const MY_PROFILE_ROUTE = "/perfil-influenciadora";

type AudienceObj = Record<string, number>;

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

  // pode ser string simples ("lifestyle") ou lista separada por vírgula
  content_style: string | null;

  audience_gender: AudienceObj | null;
  audience_age: AudienceObj | null;
  audience_cities: AudienceObj | null;

  approval_status: string | null;
};

const sum = (obj: AudienceObj) => Object.values(obj).reduce((a, b) => a + Number(b), 0);

const normalize = (obj: any): AudienceObj | null => {
  if (!obj || typeof obj !== "object") return null;
  const out: AudienceObj = {};
  for (const [k, v] of Object.entries(obj)) {
    const n = Number(v);
    if (!Number.isNaN(n)) out[String(k)] = n;
  }
  return Object.keys(out).length ? out : null;
};

const initials = (name?: string | null) => {
  const n = (name || "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, userRole } = useAuth();

  const isSelf = !!user?.id && !!id && user.id === id;

  const backTo = useMemo(() => {
    // ✅ garante que o botão voltar do topo funcione sempre
    return userRole === "contractor" ? "/dashboard-contratante" : "/dashboard-influenciadora";
  }, [userRole]);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!id) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id,name,city,state,neighborhood,bio,avatar_url,instagram,followers,content_style,audience_gender,audience_age,audience_cities,approval_status"
        )
        .eq("id", id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error("PUBLIC_PROFILE_FETCH_ERROR", error);
        setProfile(null);
      } else {
        setProfile(
          data
            ? {
                ...(data as any),
                audience_gender: normalize((data as any).audience_gender),
                audience_age: normalize((data as any).audience_age),
                audience_cities: normalize((data as any).audience_cities),
              }
            : null
        );
      }

      setLoading(false);
    };

    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const isVerified = profile?.approval_status === "approved";

  const igHandle = useMemo(() => {
    const raw = (profile?.instagram || "").trim();
    if (!raw) return null;
    return raw.replace(/^@/, "");
  }, [profile?.instagram]);

  const openInstagram = () => {
    if (!igHandle) return;
    window.open(`https://instagram.com/${igHandle}`, "_blank", "noopener,noreferrer");
  };

  const openMaps = () => {
    if (!profile) return;
    const q = encodeURIComponent(`${profile.neighborhood ? profile.neighborhood + " · " : ""}${profile.city}, ${profile.state}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener,noreferrer");
  };

  const contentStyles = useMemo(() => {
    const raw = (profile?.content_style || "").trim();
    if (!raw) return [];
    // aceita "a,b,c" ou "a | b | c" ou só "lifestyle"
    const parts = raw
      .split(/[,|]/g)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length ? parts.slice(0, 3) : [];
  }, [profile?.content_style]);

  const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--secondary))", "hsl(var(--muted-foreground))"];

  const renderDonut = (title: string, obj: AudienceObj | null) => {
    if (!obj) {
      return (
        <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{title}</div>
          <p className="text-sm text-muted-foreground mt-2">Sem dados ainda.</p>
        </div>
      );
    }

    const total = sum(obj);
    if (!total) {
      return (
        <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{title}</div>
          <p className="text-sm text-muted-foreground mt-2">Sem dados ainda.</p>
        </div>
      );
    }

    const data = Object.entries(obj)
      .map(([k, v]) => ({
        name: k,
        value: Number(v),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    return (
      <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{title}</div>

        <div className="mt-3 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={42} outerRadius={72}>
                {data.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 space-y-1">
          {data.slice(0, 4).map((it) => {
            const pct = ((it.value / total) * 100).toFixed(0);
            return (
              <div key={it.name} className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">{it.name}</span>
                <span className="shrink-0">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <MobileLayout title="Perfil público" showBack backTo={backTo} navType={userRole === "contractor" ? "contractor" : "influencer"} showNav={false} showHome={false}>
      <div className="px-6 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin w-6 h-6 text-primary" />
          </div>
        ) : !profile ? (
          <p className="text-center text-muted-foreground">Perfil não encontrado.</p>
        ) : (
          <>
            {/* ✅ Se for o dono: mensagem + CTA pro painel correto */}
            {isSelf && (
              <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-primary mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      Você está vendo seu perfil como o contratante vê.
                    </p>
                    <button
                      onClick={() => navigate(MY_PROFILE_ROUTE)}
                      className="mt-2 text-sm font-medium text-primary hover:underline"
                    >
                      Editar perfil completo
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ✅ Header (corrige o “A…” do nome) */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/5 border border-border/50 flex items-center justify-center shrink-0">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} className="w-full h-full object-cover" alt={profile.name} />
                  ) : (
                    <span className="text-primary font-bold">{initials(profile.name)}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className="text-lg font-bold text-foreground truncate min-w-0 flex-1">
                      {profile.name}
                    </h2>
                    {isVerified && <VerifiedBadge size="sm" />}
                    {isVerified && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-primary/20 bg-primary/5 text-primary inline-flex items-center gap-1 shrink-0">
                        <ShieldCheck className="w-3 h-3" />
                        Verificado Orbty
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {profile.neighborhood ? `${profile.neighborhood} · ` : ""}
                      {profile.city}, {profile.state}
                    </span>
                  </div>

                  {profile.bio ? (
                    <p className="mt-3 text-sm text-foreground/75 leading-relaxed">
                      {profile.bio}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* ✅ Cards rápidos */}
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={openInstagram}
                disabled={!igHandle}
                className={`p-4 rounded-2xl border text-left transition ${
                  igHandle ? "border-border/50 bg-card/60 hover:bg-card/80" : "border-border/30 bg-card/40 opacity-70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Instagram className="w-4 h-4 text-primary" />
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="text-xs mt-2 text-muted-foreground uppercase tracking-widest">Instagram</div>
                <div className="text-sm font-semibold text-foreground truncate">{igHandle ? `@${igHandle}` : "—"}</div>
              </button>

              <button
                type="button"
                onClick={openMaps}
                className="p-4 rounded-2xl border border-border/50 bg-card/60 hover:bg-card/80 text-left transition"
              >
                <div className="flex items-center justify-between">
                  <MapPin className="w-4 h-4 text-primary" />
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="text-xs mt-2 text-muted-foreground uppercase tracking-widest">Localização</div>
                <div className="text-sm font-semibold text-foreground truncate">{profile.city}</div>
              </button>

              <div className="p-4 rounded-2xl border border-border/50 bg-card/60 text-left">
                <Users className="w-4 h-4 text-primary" />
                <div className="text-xs mt-2 text-muted-foreground uppercase tracking-widest">Seguidores</div>
                <div className="text-sm font-semibold text-foreground truncate">{profile.followers || "—"}</div>
              </div>
            </div>

            {/* ✅ Estilos (até 3 chips) */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Estilo de conteúdo</span>
              </div>

              {contentStyles.length ? (
                <div className="flex flex-wrap gap-2">
                  {contentStyles.map((s) => (
                    <span
                      key={s}
                      className="text-xs px-3 py-2 rounded-full border border-border/50 bg-card/60 text-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Não informado.</p>
              )}
            </div>

            {/* ✅ Audiência (donuts) + cidades */}
            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Audiência</span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {renderDonut("Gênero", profile.audience_gender)}
                {renderDonut("Faixa etária", profile.audience_age)}
              </div>

              <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Principais cidades</div>

                {!profile.audience_cities ? (
                  <p className="text-sm text-muted-foreground mt-2">Sem dados ainda.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {Object.entries(profile.audience_cities)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([city, pct]) => (
                        <div key={city} className="flex items-center justify-between text-sm">
                          <span className="text-foreground truncate">{city}</span>
                          <span className="text-muted-foreground shrink-0">{pct}%</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground">
                * Audiência é informada pela creator (por enquanto). Em breve será validada via integração Meta.
              </p>
            </div>
          </>
        )}
      </div>
    </MobileLayout>
  );
}