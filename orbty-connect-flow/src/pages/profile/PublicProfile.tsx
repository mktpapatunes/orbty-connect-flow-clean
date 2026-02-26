import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft,
  Instagram,
  Loader2,
  MapPin,
  Users,
  User as UserIcon,
  Sparkles,
  BadgeCheck,
  BarChart3,
  ExternalLink,
} from "lucide-react";

type AudienceGender = Record<string, number>;

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

  gender: string | null;
  age: number | null;

  // ⚠️ privados (só mostrar se for o próprio usuário)
  email?: string;
  phone?: string;
};

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

const normalizeInstagram = (v?: string | null) => {
  const raw = (v || "").trim();
  if (!raw) return null;
  return raw.startsWith("@") ? raw.slice(1) : raw;
};

const formatFollowers = (v?: string | null) => {
  const raw = (v || "").trim();
  if (!raw) return null;
  return raw;
};

const initials = (name?: string | null) => {
  const n = (name || "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const parseAudienceGender = (ag: any): AudienceGender | null => {
  if (!ag || typeof ag !== "object") return null;
  const out: AudienceGender = {};
  for (const [k, v] of Object.entries(ag)) {
    const num = Number(v);
    if (!Number.isNaN(num)) out[String(k)] = num;
  }
  return Object.keys(out).length ? out : null;
};

const sum = (obj: Record<string, number>) => Object.values(obj).reduce((a, b) => a + b, 0);

const PublicProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isSelf = !!user?.id && !!id && user.id === id;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchProfile = async () => {
      if (!id) {
        setLoading(false);
        setProfile(null);
        return;
      }

      setLoading(true);

      // ✅ Campos públicos (e privados só se for o próprio usuário)
      const baseSelect =
        "id, name, city, state, neighborhood, bio, avatar_url, instagram, followers, content_style, audience_gender, gender, age";
      const selfExtra = ", email, phone";

      const { data, error } = await supabase
        .from("profiles")
        .select(isSelf ? baseSelect + selfExtra : baseSelect)
        .eq("id", id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error("PUBLIC_PROFILE_FETCH_ERROR", error);
        setProfile(null);
        setLoading(false);
        return;
      }

      const row = (data as any) ?? null;
      if (!row) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile({
        ...row,
        audience_gender: parseAudienceGender(row.audience_gender),
      });

      setLoading(false);
    };

    fetchProfile();

    return () => {
      mounted = false;
    };
  }, [id, isSelf]);

  const igHandle = useMemo(() => normalizeInstagram(profile?.instagram), [profile?.instagram]);
  const followers = useMemo(() => formatFollowers(profile?.followers), [profile?.followers]);

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

  const openMaps = () => {
    if (!profile) return;
    const q = encodeURIComponent(locationLabel || `${profile.city}, ${profile.state}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener,noreferrer");
  };

  const audienceData = useMemo(() => {
    const ag = profile?.audience_gender;
    if (!ag) return null;

    const total = sum(ag);
    if (total <= 0) return null;

    const sorted = Object.entries(ag)
      .map(([k, v]) => ({ key: k, value: v, pct: clamp((v / total) * 100, 0, 100) }))
      .sort((a, b) => b.pct - a.pct);

    return { total, items: sorted };
  }, [profile?.audience_gender]);

  return (
    <MobileLayout title="Perfil" showBack backTo="#" navType="contractor" showNav={false} showHome={false}>
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
            {/* =========================
               HERO / HEADER
            ========================= */}
            <div className="glass-card p-4">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 overflow-hidden flex items-center justify-center shrink-0">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-primary font-bold">{initials(profile.name)}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-foreground truncate">{profile.name}</h2>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-card/60 text-muted-foreground inline-flex items-center gap-1">
                      <BadgeCheck className="w-3 h-3" />
                      Público
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="truncate">{locationLabel}</span>
                  </div>

                  {profile.bio && (
                    <p className="mt-3 text-sm text-foreground/75 leading-relaxed">{profile.bio}</p>
                  )}
                </div>
              </div>
            </div>

            {/* =========================
               QUICK CARDS (clicáveis)
            ========================= */}
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

              <button
                type="button"
                onClick={openMaps}
                className="rounded-2xl border border-border/50 bg-card/60 hover:bg-card/80 p-3 text-left transition"
              >
                <div className="flex items-center justify-between">
                  <MapPin className="w-4 h-4 text-primary" />
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Localização</p>
                <p className="text-sm font-semibold text-foreground truncate">{profile.city}</p>
              </button>

              <div className="rounded-2xl border border-border/50 bg-card/60 p-3 text-left">
                <div className="flex items-center justify-between">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-white/5 text-muted-foreground">
                    público
                  </span>
                </div>
                <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Seguidores</p>
                <p className="text-sm font-semibold text-foreground truncate">{followers || "—"}</p>
              </div>
            </div>

            {/* =========================
               SEÇÕES (bem divididas)
            ========================= */}
            <div className="glass-card p-4 space-y-4">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-primary" />
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Informações</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border/50 bg-card/60 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Gênero</p>
                  <p className="text-sm font-semibold text-foreground">{profile.gender || "—"}</p>
                </div>

                <div className="rounded-2xl border border-border/50 bg-card/60 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Idade</p>
                  <p className="text-sm font-semibold text-foreground">{profile.age ?? "—"}</p>
                </div>

                <div className="col-span-2 rounded-2xl border border-border/50 bg-card/60 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Bairro</p>
                  <p className="text-sm font-semibold text-foreground">{profile.neighborhood || "—"}</p>
                </div>
              </div>

              {/* ⚠️ Privado — só se for o próprio usuário */}
              {isSelf && (
                <div className="rounded-2xl border border-border/50 bg-card/60 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Seus contatos (privado)</p>
                  <p className="text-sm text-foreground/80 mt-1">
                    {profile.email ? <span className="block">Email: {profile.email}</span> : null}
                    {profile.phone ? <span className="block">Telefone: {profile.phone}</span> : null}
                    {!profile.email && !profile.phone ? "—" : null}
                  </p>
                </div>
              )}
            </div>

            {/* =========================
               ESTILO DE CONTEÚDO
            ========================= */}
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Estilo</p>
              </div>

              {profile.content_style ? (
                <div className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-full border border-border/50 bg-card/60 text-foreground">
                  {profile.content_style}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Não informado.</p>
              )}
            </div>

            {/* =========================
               AUDIÊNCIA (gráfico simples)
            ========================= */}
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-primary" />
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Audiência</p>
              </div>

              {!audienceData ? (
                <p className="text-sm text-muted-foreground">Sem dados de audiência por enquanto.</p>
              ) : (
                <div className="space-y-3">
                  {audienceData.items.slice(0, 5).map((it) => (
                    <div key={it.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground font-medium">{it.key}</span>
                        <span className="text-muted-foreground">{it.pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-border/40 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60"
                          style={{ width: `${clamp(it.pct, 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </MobileLayout>
  );
};

export default PublicProfile;