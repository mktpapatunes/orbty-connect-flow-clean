// src/pages/profile/PublicProfile.tsx
// ✅ ARQUIVO COMPLETO — perfil público premium + modo editar (somente self)
// - Audience editável (por enquanto) com donut charts (Recharts)
// - Audience: Cidades, Gênero, Faixa etária
// - Selo Verificado Orbty (approval_status === "approved")
// - Compatível com audience_gender antigo (objeto simples) e novo (objeto estruturado)

import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MobileLayout from "@/components/MobileLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
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
  Pencil,
  Save,
  X,
  Plus,
  Trash2,
  ShieldCheck,
} from "lucide-react";

import {
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

type AudienceMap = Record<string, number>;

type AudienceStructured = {
  gender: AudienceMap | null;
  age: AudienceMap | null;
  cities: AudienceMap | null;
};

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

  // no banco está como Json (usamos esse mesmo campo para armazenar o estruturado)
  audience_gender: any | null;

  gender: string | null;
  age: number | null;

  approval_status?: "pending" | "approved" | "rejected" | string;

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

const sum = (obj: Record<string, number>) => Object.values(obj).reduce((a, b) => a + b, 0);

const parseAudienceMap = (obj: any): AudienceMap | null => {
  if (!obj || typeof obj !== "object") return null;
  const out: AudienceMap = {};
  for (const [k, v] of Object.entries(obj)) {
    const num = Number(v);
    if (!Number.isNaN(num)) out[String(k)] = num;
  }
  return Object.keys(out).length ? out : null;
};

/**
 * Compatibilidade:
 * - Se audience_gender vier como objeto simples { feminino: 70, masculino: 30 } => assume gender
 * - Se vier como { gender: {...}, age: {...}, cities: {...} } => usa estruturado
 */
const parseAudienceStructured = (raw: any): AudienceStructured => {
  if (!raw || typeof raw !== "object") return { gender: null, age: null, cities: null };

  const hasStructuredKeys =
    Object.prototype.hasOwnProperty.call(raw, "gender") ||
    Object.prototype.hasOwnProperty.call(raw, "age") ||
    Object.prototype.hasOwnProperty.call(raw, "cities");

  if (hasStructuredKeys) {
    return {
      gender: parseAudienceMap(raw.gender),
      age: parseAudienceMap(raw.age),
      cities: parseAudienceMap(raw.cities),
    };
  }

  // fallback: formato antigo = mapa simples => trata como gender
  return {
    gender: parseAudienceMap(raw),
    age: null,
    cities: null,
  };
};

const toPieData = (m: AudienceMap, maxItems = 6) => {
  const total = sum(m);
  if (!total) return [];
  const items = Object.entries(m)
    .map(([name, value]) => ({ name, value: Number(value) || 0 }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);

  const head = items.slice(0, maxItems);
  const tail = items.slice(maxItems);
  const other = tail.reduce((acc, cur) => acc + cur.value, 0);

  if (other > 0) head.push({ name: "Outros", value: other });

  return head;
};

// paleta simples com CSS vars (fica ok em tema escuro/claro)
const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--secondary))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--ring))",
  "hsl(var(--border))",
  "hsl(var(--primary) / 0.6)",
  "hsl(var(--accent) / 0.6)",
];

const CONTENT_STYLE_OPTIONS = [
  "Lifestyle",
  "Moda",
  "Beleza",
  "Fitness",
  "Gastronomia",
  "Viagem",
  "Tecnologia",
  "Maternidade",
  "Pets",
  "Música",
  "Humor",
  "Negócios",
  "Educação",
  "Games",
  "Fotografia",
  "Skincare",
  "Decoração",
  "Esportes",
];

type AudienceKey = "cities" | "gender" | "age";

const labelForAudienceKey = (k: AudienceKey) => {
  if (k === "cities") return "Principais cidades";
  if (k === "gender") return "Gênero";
  return "Faixa etária";
};

const placeholderKeyForAudience = (k: AudienceKey) => {
  if (k === "cities") return "Ex: São Paulo";
  if (k === "gender") return "Ex: Feminino";
  return "Ex: 18–24";
};

const PublicProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isSelf = !!user?.id && !!id && user.id === id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<ProfileRow | null>(null);

  // edição
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileRow | null>(null);
  const [audDraft, setAudDraft] = useState<AudienceStructured>({ gender: null, age: null, cities: null });

  const igHandle = useMemo(() => normalizeInstagram(profile?.instagram), [profile?.instagram]);
  const followers = useMemo(() => formatFollowers(profile?.followers), [profile?.followers]);

  const locationLabel = useMemo(() => {
    if (!profile) return "";
    const base = `${profile.city}, ${profile.state}`;
    if (profile.neighborhood) return `${profile.neighborhood} · ${base}`;
    return base;
  }, [profile]);

  const isVerifiedOrbty = useMemo(() => {
    const s = (profile as any)?.approval_status;
    return String(s) === "approved";
  }, [profile]);

  const openInstagram = () => {
    const handle = isEditing ? normalizeInstagram(draft?.instagram) : igHandle;
    if (!handle) return;
    window.open(`https://www.instagram.com/${handle}`, "_blank", "noopener,noreferrer");
  };

  const openMaps = () => {
    const p = isEditing ? draft : profile;
    if (!p) return;
    const base = `${p.city}, ${p.state}`;
    const loc = p.neighborhood ? `${p.neighborhood} · ${base}` : base;
    const q = encodeURIComponent(loc);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener,noreferrer");
  };

  const audienceStructured = useMemo(() => parseAudienceStructured(profile?.audience_gender), [profile?.audience_gender]);

  const audiencePies = useMemo(() => {
    const src = isEditing ? audDraft : audienceStructured;

    const mk = (m: AudienceMap | null) => {
      if (!m) return null;
      const total = sum(m);
      if (total <= 0) return null;
      return { total, data: toPieData(m, 6) };
    };

    return {
      cities: mk(src.cities || null),
      gender: mk(src.gender || null),
      age: mk(src.age || null),
    };
  }, [audienceStructured, isEditing, audDraft]);

  const fetchProfile = useCallback(async () => {
    if (!id) {
      setLoading(false);
      setProfile(null);
      return;
    }

    setLoading(true);

    // ✅ Campos públicos (e privados só se for o próprio usuário)
    const baseSelect =
      "id, name, city, state, neighborhood, bio, avatar_url, instagram, followers, content_style, audience_gender, gender, age, approval_status";
    const selfExtra = ", email, phone";

    const { data, error } = await supabase
      .from("profiles")
      .select(isSelf ? baseSelect + selfExtra : baseSelect)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("PUBLIC_PROFILE_FETCH_ERROR", error);
      setProfile(null);
      setLoading(false);
      return;
    }

    const row = (data as any) ?? null;
    setProfile(row);
    setLoading(false);
  }, [id, isSelf]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!mounted) return;
      await fetchProfile();
    })();

    return () => {
      mounted = false;
    };
  }, [fetchProfile]);

  const startEdit = () => {
    if (!profile) return;
    setDraft({ ...profile });
    setAudDraft(parseAudienceStructured(profile.audience_gender));
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraft(null);
    setAudDraft({ gender: null, age: null, cities: null });
  };

  const updateDraft = <K extends keyof ProfileRow>(key: K, value: ProfileRow[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateAudienceItem = (section: AudienceKey, key: string, value: number) => {
    setAudDraft((prev) => {
      const current = prev[section] ? { ...(prev[section] as AudienceMap) } : {};
      if (!key.trim()) return prev;
      current[key.trim()] = Number.isFinite(value) ? value : 0;
      return { ...prev, [section]: current };
    });
  };

  const removeAudienceItem = (section: AudienceKey, key: string) => {
    setAudDraft((prev) => {
      const current = prev[section] ? { ...(prev[section] as AudienceMap) } : {};
      delete current[key];
      return { ...prev, [section]: Object.keys(current).length ? current : null };
    });
  };

  const addAudienceEmpty = (section: AudienceKey) => {
    // adiciona um placeholder editável
    const placeholderKey = placeholderKeyForAudience(section);
    setAudDraft((prev) => {
      const current = prev[section] ? { ...(prev[section] as AudienceMap) } : {};
      let k = placeholderKey;
      let i = 2;
      while (Object.prototype.hasOwnProperty.call(current, k)) {
        k = `${placeholderKey} ${i++}`;
      }
      current[k] = 0;
      return { ...prev, [section]: current };
    });
  };

  const saveProfile = async () => {
    if (!draft || !id) return;

    if (!draft.name?.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    if (!draft.city?.trim() || !draft.state?.trim()) {
      toast.error("Cidade e Estado são obrigatórios.");
      return;
    }

    setSaving(true);
    try {
      // grava audiência estruturada no mesmo campo audience_gender (Json)
      const audience_payload = {
        gender: audDraft.gender ?? null,
        age: audDraft.age ?? null,
        cities: audDraft.cities ?? null,
      };

      const payload: any = {
        name: draft.name.trim(),
        city: draft.city.trim(),
        state: draft.state.trim(),
        neighborhood: (draft.neighborhood || "").trim() || null,
        bio: (draft.bio || "").trim() || null,
        avatar_url: (draft.avatar_url || "").trim() || null,
        instagram: (draft.instagram || "").trim() || null,
        followers: (draft.followers || "").trim() || null,
        content_style: draft.content_style || null,
        gender: draft.gender || null,
        age: typeof draft.age === "number" ? draft.age : draft.age ? Number(draft.age) : null,
        audience_gender: audience_payload,
      };

      // privados: só atualiza se self
      if (isSelf) {
        payload.email = (draft.email || "").trim() || payload.email;
        payload.phone = (draft.phone || "").trim() || payload.phone;
      }

      const { error } = await supabase.from("profiles").update(payload).eq("id", id);

      if (error) {
        console.error("PUBLIC_PROFILE_SAVE_ERROR", error);
        toast.error("Erro ao salvar perfil.");
        return;
      }

      toast.success("Perfil atualizado!");
      setIsEditing(false);
      setDraft(null);
      await fetchProfile();
    } finally {
      setSaving(false);
    }
  };

  const renderDonut = (title: string, pie: { total: number; data: { name: string; value: number }[] } | null) => {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">{title}</p>
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-white/5 text-muted-foreground">
            {pie ? `${pie.total}` : "—"}
          </span>
        </div>

        {!pie ? (
          <p className="text-sm text-muted-foreground">Sem dados.</p>
        ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pie.data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {pie.data.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  const renderAudienceEditor = (section: AudienceKey) => {
    const map = (audDraft[section] || {}) as AudienceMap;

    const entries = Object.entries(map);
    const has = entries.length > 0;

    return (
      <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">{labelForAudienceKey(section)}</p>

          <button
            type="button"
            onClick={() => addAudienceEmpty(section)}
            className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-xl border border-border/50 bg-white/5 hover:bg-white/10 transition"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>

        {!has ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Sem dados. Clique em <b>Adicionar</b> para preencher (temporário até integração Meta).
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {entries.map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <input
                  value={k}
                  onChange={(e) => {
                    const newKey = e.target.value;
                    // rename key: remove old add new
                    setAudDraft((prev) => {
                      const current = prev[section] ? { ...(prev[section] as AudienceMap) } : {};
                      const val = current[k];
                      delete current[k];
                      if (newKey.trim()) current[newKey.trim()] = val ?? 0;
                      return { ...prev, [section]: Object.keys(current).length ? current : null };
                    });
                  }}
                  className="flex-1 rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm text-foreground focus:outline-none"
                  placeholder={placeholderKeyForAudience(section)}
                />
                <input
                  type="number"
                  value={Number(v)}
                  onChange={(e) => updateAudienceItem(section, k, Number(e.target.value))}
                  className="w-24 rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm text-foreground focus:outline-none"
                  placeholder="0"
                />
                <button
                  type="button"
                  onClick={() => removeAudienceItem(section, k)}
                  className="rounded-xl border border-border/50 bg-white/5 hover:bg-white/10 transition p-2 text-muted-foreground hover:text-foreground"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground mt-2">
              Dica: preencha valores absolutos (ex.: 1200) ou percentuais (ex.: 65). O gráfico mostra proporção.
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <MobileLayout title="Perfil" showBack backTo="#" navType="contractor" showNav={false} showHome={false}>
      <div className="px-6 py-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>

          {/* ✅ CTA editar (somente self) */}
          {isSelf && !loading && profile && !isEditing && (
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 transition"
              title="Editar perfil"
            >
              <Pencil className="w-4 h-4" />
              Editar
            </button>
          )}

          {/* ✅ Ações de edição */}
          {isSelf && isEditing && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-xl border border-border/50 bg-card/60 hover:bg-card/80 transition disabled:opacity-60"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
                className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 transition disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          )}
        </div>

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
                  {(isEditing ? draft?.avatar_url : profile.avatar_url) ? (
                    <img
                      src={(isEditing ? draft?.avatar_url : profile.avatar_url) as string}
                      alt={isEditing ? draft?.name || "" : profile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-primary font-bold">
                      {initials(isEditing ? draft?.name : profile.name)}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {!isEditing ? (
                      <h2 className="text-lg font-bold text-foreground truncate">{profile.name}</h2>
                    ) : (
                      <input
                        value={draft?.name ?? ""}
                        onChange={(e) => updateDraft("name", e.target.value)}
                        className="w-full rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm text-foreground focus:outline-none"
                        placeholder="Seu nome"
                      />
                    )}

                    {/* ✅ Selo verificado Orbty */}
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-card/60 text-muted-foreground inline-flex items-center gap-1">
                      {isVerifiedOrbty ? (
                        <>
                          <ShieldCheck className="w-3 h-3 text-primary" />
                          Verificado Orbty
                        </>
                      ) : (
                        <>
                          <BadgeCheck className="w-3 h-3" />
                          Perfil público
                        </>
                      )}
                    </span>
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground inline-flex items-center gap-1 w-full">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {!isEditing ? (
                      <span className="truncate">{locationLabel}</span>
                    ) : (
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <input
                          value={draft?.city ?? ""}
                          onChange={(e) => updateDraft("city", e.target.value)}
                          className="rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm text-foreground focus:outline-none"
                          placeholder="Cidade"
                        />
                        <input
                          value={draft?.state ?? ""}
                          onChange={(e) => updateDraft("state", e.target.value)}
                          className="rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm text-foreground focus:outline-none"
                          placeholder="UF"
                        />
                        <input
                          value={draft?.neighborhood ?? ""}
                          onChange={(e) => updateDraft("neighborhood", e.target.value)}
                          className="col-span-2 rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm text-foreground focus:outline-none"
                          placeholder="Bairro (opcional)"
                        />
                      </div>
                    )}
                  </div>

                  {!isEditing ? (
                    profile.bio ? (
                      <p className="mt-3 text-sm text-foreground/75 leading-relaxed">{profile.bio}</p>
                    ) : null
                  ) : (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={draft?.bio ?? ""}
                        onChange={(e) => updateDraft("bio", e.target.value)}
                        className="w-full min-h-[84px] rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm text-foreground focus:outline-none"
                        placeholder="Bio (opcional)"
                      />
                      <input
                        value={draft?.avatar_url ?? ""}
                        onChange={(e) => updateDraft("avatar_url", e.target.value)}
                        className="w-full rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm text-foreground focus:outline-none"
                        placeholder="URL do avatar (opcional)"
                      />
                    </div>
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
                disabled={!normalizeInstagram(isEditing ? draft?.instagram : profile.instagram)}
                className={`rounded-2xl border p-3 text-left transition ${
                  normalizeInstagram(isEditing ? draft?.instagram : profile.instagram)
                    ? "border-border/50 bg-card/60 hover:bg-card/80"
                    : "border-border/30 bg-card/40 opacity-70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Instagram className="w-4 h-4 text-primary" />
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Instagram</p>
                {!isEditing ? (
                  <p className="text-sm font-semibold text-foreground truncate">{igHandle ? `@${igHandle}` : "—"}</p>
                ) : (
                  <input
                    value={draft?.instagram ?? ""}
                    onChange={(e) => updateDraft("instagram", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border/50 bg-background/40 px-2 py-1.5 text-sm text-foreground focus:outline-none"
                    placeholder="@usuario"
                  />
                )}
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
                <p className="text-sm font-semibold text-foreground truncate">
                  {(isEditing ? draft?.city : profile.city) || "—"}
                </p>
              </button>

              <div className="rounded-2xl border border-border/50 bg-card/60 p-3 text-left">
                <div className="flex items-center justify-between">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-white/5 text-muted-foreground">
                    público
                  </span>
                </div>
                <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Seguidores</p>
                {!isEditing ? (
                  <p className="text-sm font-semibold text-foreground truncate">{followers || "—"}</p>
                ) : (
                  <input
                    value={draft?.followers ?? ""}
                    onChange={(e) => updateDraft("followers", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border/50 bg-background/40 px-2 py-1.5 text-sm text-foreground focus:outline-none"
                    placeholder="Ex: 12.5k"
                  />
                )}
              </div>
            </div>

            {/* =========================
               INFO + (privado self)
            ========================= */}
            <div className="glass-card p-4 space-y-4">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-primary" />
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Informações</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border/50 bg-card/60 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Gênero</p>
                  {!isEditing ? (
                    <p className="text-sm font-semibold text-foreground">{profile.gender || "—"}</p>
                  ) : (
                    <input
                      value={draft?.gender ?? ""}
                      onChange={(e) => updateDraft("gender", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-border/50 bg-background/40 px-2 py-1.5 text-sm text-foreground focus:outline-none"
                      placeholder="Ex: Feminino"
                    />
                  )}
                </div>

                <div className="rounded-2xl border border-border/50 bg-card/60 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Idade</p>
                  {!isEditing ? (
                    <p className="text-sm font-semibold text-foreground">{profile.age ?? "—"}</p>
                  ) : (
                    <input
                      type="number"
                      value={draft?.age ?? ""}
                      onChange={(e) => updateDraft("age", e.target.value as any)}
                      className="mt-1 w-full rounded-xl border border-border/50 bg-background/40 px-2 py-1.5 text-sm text-foreground focus:outline-none"
                      placeholder="Ex: 24"
                    />
                  )}
                </div>
              </div>

              {/* ⚠️ Privado — só se for o próprio usuário */}
              {isSelf && (
                <div className="rounded-2xl border border-border/50 bg-card/60 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Seus contatos (privado)</p>
                  {!isEditing ? (
                    <p className="text-sm text-foreground/80 mt-1">
                      {profile.email ? <span className="block">Email: {profile.email}</span> : null}
                      {profile.phone ? <span className="block">Telefone: {profile.phone}</span> : null}
                      {!profile.email && !profile.phone ? "—" : null}
                    </p>
                  ) : (
                    <div className="mt-2 grid grid-cols-1 gap-2">
                      <input
                        value={draft?.email ?? ""}
                        onChange={(e) => updateDraft("email", e.target.value)}
                        className="w-full rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm text-foreground focus:outline-none"
                        placeholder="Email (privado)"
                      />
                      <input
                        value={draft?.phone ?? ""}
                        onChange={(e) => updateDraft("phone", e.target.value)}
                        className="w-full rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm text-foreground focus:outline-none"
                        placeholder="Telefone (privado)"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* =========================
               ESTILO DE CONTEÚDO (categorias)
            ========================= */}
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Estilo de conteúdo</p>
              </div>

              {!isEditing ? (
                profile.content_style ? (
                  <div className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-full border border-border/50 bg-card/60 text-foreground">
                    {profile.content_style}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Não informado.</p>
                )
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  <select
                    value={draft?.content_style ?? ""}
                    onChange={(e) => updateDraft("content_style", e.target.value || null)}
                    className="w-full rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm text-foreground focus:outline-none"
                  >
                    <option value="">Selecione uma categoria</option>
                    {CONTENT_STYLE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>

                  <p className="text-[11px] text-muted-foreground">
                    (Você pode expandir a lista quando quiser. Por enquanto mantive 1 categoria por perfil para bater com o campo
                    `content_style` como string.)
                  </p>
                </div>
              )}
            </div>

            {/* =========================
               AUDIÊNCIA (somente público) + edição (self)
            ========================= */}
            <div className="glass-card p-4 space-y-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Audiência</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isSelf
                      ? "Editável por enquanto (até integrar com Meta)."
                      : "Principais insights do público deste creator."}
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-white/5 text-muted-foreground">
                  apenas público
                </span>
              </div>

              {/* Donuts */}
              <div className="grid grid-cols-1 gap-3">
                {renderDonut("Cidades", audiencePies.cities)}
                {renderDonut("Gênero", audiencePies.gender)}
                {renderDonut("Faixa etária", audiencePies.age)}
              </div>

              {/* Editor (somente self + edit mode) */}
              {isSelf && isEditing && (
                <div className="space-y-3">
                  {renderAudienceEditor("cities")}
                  {renderAudienceEditor("gender")}
                  {renderAudienceEditor("age")}
                </div>
              )}

              {/* Hint quando vazio */}
              {!isEditing && !audiencePies.cities && !audiencePies.gender && !audiencePies.age && (
                <div className="rounded-2xl border border-border/50 bg-card/60 p-3 text-sm text-muted-foreground">
                  Ainda não há dados de audiência. {isSelf ? "Clique em Editar para preencher temporariamente." : null}
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