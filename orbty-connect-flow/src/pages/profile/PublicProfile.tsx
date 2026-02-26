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
  User as UserIcon,
  Sparkles,
  BarChart3,
  ExternalLink,
  ShieldCheck,
  Building2,
} from "lucide-react";

import { PieChart, Pie, ResponsiveContainer, Tooltip, Cell } from "recharts";

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

  content_style: string | null;

  // audiência editável (salva em profiles pelo painel)
  audience_gender: AudienceObj | null; // { female: 60, male: 40 } (ou qualquer chave)
  audience_age: AudienceObj | null; // { "18-24": 30, ... }
  audience_cities: AudienceObj | null; // { "São Paulo": 40, "Rio": 20, ... }

  gender: string | null;
  age: number | null;

  // opcional (se você tiver)
  approval_status?: string | null;
  role?: string | null;
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

const normalizeAudienceObj = (obj: any): AudienceObj | null => {
  if (!obj || typeof obj !== "object") return null;
  const out: AudienceObj = {};
  for (const [k, v] of Object.entries(obj)) {
    const num = Number(v);
    if (!Number.isNaN(num) && num >= 0) out[String(k)] = num;
  }
  return Object.keys(out).length ? out : null;
};

const sum = (obj: Record<string, number>) => Object.values(obj).reduce((a, b) => a + b, 0);

function toPieData(obj: AudienceObj, limit = 6) {
  const total = sum(obj);
  if (!total) return { total: 0, data: [] as { name: string; value: number; pct: number }[] };

  const items = Object.entries(obj)
    .map(([k, v]) => ({ name: k, value: Number(v), pct: clamp((Number(v) / total) * 100) }))
    .sort((a, b) => b.pct - a.pct);

  const head = items.slice(0, limit);
  const rest = items.slice(limit);

  if (rest.length) {
    const restPct = rest.reduce((acc, x) => acc + x.pct, 0);
    head.push({ name: "Outros", value: rest.reduce((acc, x) => acc + x.value, 0), pct: clamp(restPct) });
  }

  return { total, data: head };
}

function prettifyGenderKey(k: string) {
  const n = (k || "").toLowerCase();
  if (n === "female" || n === "feminino" || n === "women") return "Feminino";
  if (n === "male" || n === "masculino" || n === "men") return "Masculino";
  return k;
}

function contentStylesArray(raw?: string | null) {
  const s = (raw || "").trim();
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function openExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

const PublicProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, userRole, approvalStatus } = useAuth();

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

      // ✅ Campos públicos (+ alguns extras caso existam)
      const select =
  "id, name, city, state, neighborhood, bio, avatar_url, instagram, followers, content_style, audience_gender, audience_age, audience_cities, gender, age, approval_status";

      const { data, error } = await supabase.from("profiles").select(select).eq("id", id).maybeSingle();

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
        audience_gender: normalizeAudienceObj(row.audience_gender),
        audience_age: normalizeAudienceObj(row.audience_age),
        audience_cities: normalizeAudienceObj(row.audience_cities),
      });

      setLoading(false);
    };

    fetchProfile();

    return () => {
      mounted = false;
    };
  }, [id]);

  const igHandle = useMemo(() => normalizeInstagram(profile?.instagram), [profile?.instagram]);
  const followers = useMemo(() => formatFollowers(profile?.followers), [profile?.followers]);

  const locationLabel = useMemo(() => {
    if (!profile) return "";
    const base = `${profile.city}, ${profile.state}`;
    if (profile.neighborhood) return `${profile.neighborhood} · ${base}`;
    return base;
  }, [profile]);

  // ✅ verificado (prioridade: auth self / fallback: approval_status da tabela)
  const isVerified = useMemo(() => {
    if (isSelf && userRole === "influencer") return approvalStatus === "approved";
    const st = String((profile as any)?.approval_status ?? "").toLowerCase();
    return st === "approved";
  }, [isSelf, userRole, approvalStatus, profile]);

  const styles = useMemo(() => contentStylesArray(profile?.content_style), [profile?.content_style]);

  const openInstagram = () => {
    if (!igHandle) return;
    openExternal(`https://www.instagram.com/${igHandle}`);
  };

  const openMaps = () => {
    if (!profile) return;
    const q = encodeURIComponent(locationLabel || `${profile.city}, ${profile.state}`);
    openExternal(`https://www.google.com/maps/search/?api=1&query=${q}`);
  };

  const genderPie = useMemo(() => {
    const ag = profile?.audience_gender;
    if (!ag) return null;

    // normaliza nomes bonitos
    const mapped: AudienceObj = {};
    for (const [k, v] of Object.entries(ag)) mapped[prettifyGenderKey(k)] = Number(v);

    const { data } = toPieData(mapped, 4);
    return data.length ? data : null;
  }, [profile?.audience_gender]);

  const agePie = useMemo(() => {
    const aa = profile?.audience_age;
    if (!aa) return null;
    const { data } = toPieData(aa, 6);
    return data.length ? data : null;
  }, [profile?.audience_age]);

  const topCities = useMemo(() => {
    const ac = profile?.audience_cities;
    if (!ac) return null;

    const total = sum(ac);
    if (!total) return null;

    return Object.entries(ac)
      .map(([k, v]) => ({ name: k, pct: clamp((Number(v) / total) * 100) }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6);
  }, [profile?.audience_cities]);

  // paleta por CSS vars (fica alinhado ao tema)
  const PIE_COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--accent))",
    "hsl(var(--secondary))",
    "hsl(var(--muted-foreground))",
    "hsl(var(--destructive))",
    "hsl(var(--foreground))",
  ];

  return (
    <MobileLayout
      title="Perfil público"
      showBack
      backTo="#"
      navType="contractor"
      showNav={false}
      showHome={false}
    >
      <div className="px-6 py-6 space-y-4">
        {/* Voltar (extra, além do showBack) */}
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
               HERO / HEADER (premium)
            ========================= */}
            <div className="glass-card p-4">
              <div className="flex items-start gap-3">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 overflow-hidden flex items-center justify-center shrink-0">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-primary font-bold">{initials(profile.name)}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-foreground truncate">{profile.name}</h2>

                    {isVerified ? (
                      <span className="inline-flex items-center gap-2 text-[10px] px-2 py-0.5 rounded-full border border-primary/25 bg-primary/10 text-primary">
                        <ShieldCheck className="w-3 h-3" />
                        Verificado Orbty
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-card/60 text-muted-foreground">
                        <UserIcon className="w-3 h-3" />
                        Perfil público
                      </span>
                    )}
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1 min-w-0">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{locationLabel}</span>
                  </div>

                  {profile.bio && (
                    <p className="mt-3 text-sm text-foreground/75 leading-relaxed">{profile.bio}</p>
                  )}

                  {/* (Opcional) Se quiser o badge real do componente */}
                  {isVerified && (
                    <div className="mt-3">
                      <VerifiedBadge size="sm" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* =========================
               QUICK CARDS (100% clicáveis)
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
               ESTILOS (chips)
            ========================= */}
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Estilos</p>
              </div>

              {styles.length ? (
                <div className="flex flex-wrap gap-2">
                  {styles.slice(0, 6).map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-full border border-border/50 bg-card/60 text-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Não informado.</p>
              )}
            </div>

            {/* =========================
               AUDIÊNCIA (somente no público)
               Donuts/pizza + top cidades
            ========================= */}
            <div className="glass-card p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Audiência</p>
                </div>
                <span className="text-[10px] px-2 py-1 rounded-full border border-border/50 bg-card/60 text-muted-foreground">
                  dados declarados
                </span>
              </div>

              {!genderPie && !agePie && !topCities ? (
                <p className="text-sm text-muted-foreground">Sem dados de audiência por enquanto.</p>
              ) : (
                <div className="space-y-4">
                  {/* Donuts */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Gênero */}
                    <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Gênero</p>

                      {genderPie ? (
                        <div className="h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={genderPie}
                                dataKey="pct"
                                nameKey="name"
                                innerRadius={42}
                                outerRadius={62}
                                paddingAngle={2}
                              >
                                {genderPie.map((_, i) => (
                                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value: any, name: any) => [`${Number(value).toFixed(0)}%`, name]}
                                contentStyle={{
                                  background: "rgba(0,0,0,0.8)",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  borderRadius: 12,
                                  color: "white",
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Não informado.</p>
                      )}

                      {genderPie && (
                        <div className="mt-2 space-y-1">
                          {genderPie.map((it, idx) => (
                            <div key={it.name} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{it.name}</span>
                              <span className="text-foreground font-medium">{it.pct.toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Idade */}
                    <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Faixa etária</p>

                      {agePie ? (
                        <div className="h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={agePie}
                                dataKey="pct"
                                nameKey="name"
                                innerRadius={42}
                                outerRadius={62}
                                paddingAngle={2}
                              >
                                {agePie.map((_, i) => (
                                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value: any, name: any) => [`${Number(value).toFixed(0)}%`, name]}
                                contentStyle={{
                                  background: "rgba(0,0,0,0.8)",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  borderRadius: 12,
                                  color: "white",
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Não informado.</p>
                      )}

                      {agePie && (
                        <div className="mt-2 space-y-1">
                          {agePie.slice(0, 4).map((it) => (
                            <div key={it.name} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{it.name}</span>
                              <span className="text-foreground font-medium">{it.pct.toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Top cidades */}
                  <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Principais localizações</p>
                      <span className="text-[10px] text-muted-foreground">Top cidades</span>
                    </div>

                    {!topCities ? (
                      <p className="text-sm text-muted-foreground mt-2">Não informado.</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {topCities.map((c) => (
                          <div key={c.name} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-foreground font-medium truncate">{c.name}</span>
                              <span className="text-muted-foreground">{c.pct.toFixed(0)}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-border/40 overflow-hidden">
                              <div className="h-full rounded-full bg-primary/60" style={{ width: `${clamp(c.pct)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* (Opcional) bloco confiança / credibilidade */}
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-primary" />
                <h4 className="font-semibold text-foreground text-sm">Credibilidade</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                {isVerified
                  ? "Este creator foi verificado pela Orbty."
                  : "Creator ainda não verificado pela Orbty (verificação em andamento)."}
              </p>
            </div>
          </>
        )}
      </div>
    </MobileLayout>
  );
};

export default PublicProfile;