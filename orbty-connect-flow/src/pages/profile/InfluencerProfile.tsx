import { useEffect, useMemo, useRef, useState } from "react";
import MobileLayout from "@/components/MobileLayout";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useAuth } from "@/contexts/AuthContext";
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
  UserRound,
  Lock,
  BarChart3,
  Plus,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useNavigate } from "react-router-dom";

function GlassCard(props: { children: React.ReactNode; className?: string }) {
  return <div className={`glass-card p-5 ${props.className ?? ""}`}>{props.children}</div>;
}

function MetricCard(props: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
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

// ====== Audience model (editável manualmente por enquanto) ======
type AudienceGender = { female: number; male: number };
type AudienceAgeKey = "18-24" | "25-34" | "35-44" | "45-54" | "55-64" | "65+";
type AudienceAge = Record<AudienceAgeKey, number>;
type AudienceCityRow = { city: string; pct: number };

const AGE_KEYS: AudienceAgeKey[] = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const sumObj = (obj: Record<string, number>) => Object.values(obj).reduce((a, b) => a + (Number(b) || 0), 0);

const normalizeStyles = (raw?: string | null) => {
  const s = (raw || "").trim();
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 3);
};

const stylesCatalog = [
  "Lifestyle",
  "Moda",
  "Beleza",
  "Educação",
  "Fitness",
  "Saúde",
  "Gastronomia",
  "Viagem",
  "Entretenimento",
  "Tecnologia",
  "Negócios",
  "Maternidade",
  "Pets",
  "Games",
  "Finanças",
];

export default function InfluencerProfile() {
  const navigate = useNavigate();
  const { profile, userRole, approvalStatus, refreshProfile } = useAuth();

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
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar foto.");
    } finally {
      setAvatarUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ======================
  // Load performance (Orbty)
  // ======================
  const [orbtyStats, setOrbtyStats] = useState({ total: 0, accepted: 0, pending: 0, rejected: 0 });
  const [loadingOrbty, setLoadingOrbty] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!profile?.id) return;
      setLoadingOrbty(true);

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
      const pending = list.filter((x: any) => x.status === "pending").length;
      const rejected = list.filter((x: any) => x.status === "rejected").length;

      setOrbtyStats({ total, accepted, pending, rejected });
      setLoadingOrbty(false);
    })();

    return () => {
      alive = false;
    };
  }, [profile?.id]);

  // ======================
  // Edit modal (Tudo em 1)
  // ======================
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const initialFromProfile = useMemo(() => {
    const p: any = profile ?? {};
    const audGenderRaw = p.audience_gender ?? null;
    const audAgeRaw = p.audience_age ?? null;
    const audCitiesRaw = p.audience_cities ?? null;

    const gender: AudienceGender = {
      female: clamp(Number(audGenderRaw?.female ?? 50), 0, 100),
      male: clamp(Number(audGenderRaw?.male ?? 50), 0, 100),
    };

    // se vier incoerente, normaliza
    const totalG = gender.female + gender.male;
    if (totalG !== 100) {
      const f = clamp(gender.female, 0, 100);
      gender.female = f;
      gender.male = 100 - f;
    }

    const age: AudienceAge = {
      "18-24": clamp(Number(audAgeRaw?.["18-24"] ?? 0), 0, 100),
      "25-34": clamp(Number(audAgeRaw?.["25-34"] ?? 0), 0, 100),
      "35-44": clamp(Number(audAgeRaw?.["35-44"] ?? 0), 0, 100),
      "45-54": clamp(Number(audAgeRaw?.["45-54"] ?? 0), 0, 100),
      "55-64": clamp(Number(audAgeRaw?.["55-64"] ?? 0), 0, 100),
      "65+": clamp(Number(audAgeRaw?.["65+"] ?? 0), 0, 100),
    };

    const cities: AudienceCityRow[] = Array.isArray(audCitiesRaw)
      ? audCitiesRaw
          .map((r: any) => ({
            city: String(r?.city ?? "").trim(),
            pct: clamp(Number(r?.pct ?? 0), 0, 100),
          }))
          .filter((r: AudienceCityRow) => r.city)
          .slice(0, 6)
      : [];

    return {
      instagram: String(p.instagram ?? ""),
      followers: String(p.followers ?? ""),
      bio: String(p.bio ?? ""),
      neighborhood: String(p.neighborhood ?? ""),
      contentStyles: normalizeStyles(p.content_style),
      audienceGender: gender,
      audienceAge: age,
      audienceCities: cities.length ? cities : [{ city: "", pct: 0 }],
    };
  }, [profile]);

  const [form, setForm] = useState(initialFromProfile);

  // só reseta ao abrir modal (não perde foco enquanto digita)
  useEffect(() => {
    if (editOpen) setForm(initialFromProfile);
  }, [editOpen, initialFromProfile]);

  const handleToggleStyle = (style: string) => {
    setForm((s) => {
      const has = s.contentStyles.includes(style);
      if (has) return { ...s, contentStyles: s.contentStyles.filter((x) => x !== style) };
      if (s.contentStyles.length >= 3) {
        toast.error("Você pode escolher até 3 estilos.");
        return s;
      }
      return { ...s, contentStyles: [...s.contentStyles, style] };
    });
  };

  const setAudienceFemale = (female: number) => {
    const f = clamp(Math.round(female), 0, 100);
    setForm((s) => ({
      ...s,
      audienceGender: { female: f, male: 100 - f },
    }));
  };

  const handleSaveAll = async () => {
    if (!profile?.id) return;

    // followers como string (igual você já usa)
    const followers = (form.followers || "").trim();

    // audience age: se quiser, pode “normalizar” pra somar 100, mas por enquanto deixo livre
    const ageTotal = sumObj(form.audienceAge);
    if (ageTotal > 0 && ageTotal < 50) {
      // só um guard leve, evita salvar algo muito estranho
      // (não bloqueio, só aviso)
      toast.message("Dica: sua distribuição etária parece baixa. Você pode ajustar depois.");
    }

    const cleanCities = (form.audienceCities || [])
      .map((r) => ({ city: (r.city || "").trim(), pct: clamp(Number(r.pct || 0), 0, 100) }))
      .filter((r) => r.city)
      .slice(0, 6);

    setSaving(true);
    try {
      const payload: any = {
        instagram: form.instagram.trim() || null,
        followers: followers || null,
        bio: form.bio.trim() || null,
        neighborhood: form.neighborhood.trim() || null,
        content_style: form.contentStyles.length ? form.contentStyles.join(", ") : null,

        // público (manual por enquanto, depois integra Meta)
        audience_gender: form.audienceGender,
        audience_age: form.audienceAge,
        audience_cities: cleanCities.length ? cleanCities : null,
      };

      const { error } = await supabase.from("profiles").update(payload).eq("id", profile.id);
      if (error) throw error;

      toast.success("Perfil atualizado!");
      setEditOpen(false);
      await refreshProfile();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  };

  // Labels
  const igHandle = (profile as any)?.instagram ?? null;
  const followersLabel = useMemo(() => {
    const raw = String((profile as any)?.followers ?? "").trim();
    if (!raw) return "—";
    const n = Number(raw.replace(/[^\d]/g, ""));
    return Number.isFinite(n) && n > 0 ? n.toLocaleString("pt-BR") : raw;
  }, [profile]);

  const stylesLabel = useMemo(() => {
    const arr = normalizeStyles((profile as any)?.content_style ?? null);
    return arr.length ? arr.join(", ") : "—";
  }, [profile]);

  const navType = "influencer";
  const backTo = "/dashboard-influenciadora";

  return (
    <MobileLayout title="Meu perfil" showBack backTo={backTo} navType={navType}>
      <div className="px-6 py-6 space-y-6">
        {/* Header premium */}
        <GlassCard>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-primary/30 bg-white/5">
                    {(profile as any)?.avatar_url ? (
                      <img
                        src={(profile as any).avatar_url}
                        alt="Avatar"
                        className="w-full h-full object-cover block"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full" />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handlePickAvatar}
                    disabled={avatarUploading}
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center disabled:opacity-60"
                    title="Alterar foto"
                  >
                    {avatarUploading ? (
                      <Loader2 className="w-3.5 h-3.5 text-primary-foreground animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5 text-primary-foreground" />
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
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* ✅ sem truncate (corrige G... e mantém layout) */}
                    <div className="text-lg font-semibold text-foreground break-words leading-tight">
                      {profile?.name || "Creator"}
                    </div>
                    {isVerifiedInfluencer && <VerifiedBadge size="sm" />}
                  </div>

                  {/* @ */}
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Instagram className="w-4 h-4" />
                    {buildInstagramLinks(igHandle)?.raw ? (
                      <button
                        onClick={() => openInstagram(igHandle)}
                        className="inline-flex items-center gap-1 text-primary hover:opacity-90 transition-opacity"
                        title="Abrir Instagram"
                      >
                        <span>@{buildInstagramLinks(igHandle)!.raw}</span>
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    ) : (
                      <span>Instagram não informado</span>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{profile ? `${profile.city}, ${profile.state}` : "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ações (não quebram layout) */}
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => setEditOpen(true)}
                className="rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-primary" />
                Editar perfil
              </button>

              <button
                onClick={() => navigate("/perfil-influenciadora/dados-pessoais")}
                className="rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition flex items-center gap-2"
              >
                <Lock className="w-4 h-4 text-primary" />
                Dados pessoais
              </button>
            </div>
          </div>
        </GlassCard>

        {/* Cards principais */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Seguidores" value={followersLabel} icon={<Users className="w-4 h-4 text-primary" />} />
          <MetricCard label="Estilos" value={stylesLabel} icon={<Sparkles className="w-4 h-4 text-primary" />} />
        </div>

        {/* Audiência (aparece no perfil do dono também — mas é o “painel completo”) */}
        <GlassCard className="space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <div className="text-sm font-semibold text-foreground">Audiência (manual por enquanto)</div>
          </div>

          {(() => {
            const p: any = profile ?? {};
            const g = p.audience_gender ?? null;
            const a = p.audience_age ?? null;
            const c = p.audience_cities ?? null;

            const female = typeof g?.female === "number" ? g.female : null;
            const male = typeof g?.male === "number" ? g.male : null;

            const topCities = Array.isArray(c) ? c.slice(0, 3) : [];
            const ageTotal = a && typeof a === "object" ? sumObj(a) : 0;

            return (
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Público feminino" value={female === null ? "—" : `${female.toFixed(0)}%`} />
                <MetricCard label="Público masculino" value={male === null ? "—" : `${male.toFixed(0)}%`} />
                <div className="col-span-2 rounded-2xl border border-border/50 bg-white/5 p-4">
                  <div className="text-xs text-muted-foreground mb-2">Faixa etária</div>
                  <div className="text-sm text-foreground/80">
                    {ageTotal > 0 ? "Distribuição cadastrada" : "—"}
                  </div>
                </div>
                <div className="col-span-2 rounded-2xl border border-border/50 bg-white/5 p-4">
                  <div className="text-xs text-muted-foreground mb-2">Principais cidades</div>
                  {topCities.length ? (
                    <div className="flex flex-wrap gap-2">
                      {topCities.map((r: any, idx: number) => (
                        <span
                          key={`${r.city}-${idx}`}
                          className="text-xs px-3 py-1.5 rounded-full border border-border/50 bg-card/60 text-muted-foreground"
                        >
                          {r.city} · {Number(r.pct ?? 0).toFixed(0)}%
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-foreground/80">—</div>
                  )}
                </div>
              </div>
            );
          })()}
        </GlassCard>

        {/* Performance Orbty */}
        <GlassCard className="space-y-3">
          <div className="text-sm font-semibold text-foreground">Performance na Orbty</div>

          {loadingOrbty ? (
            <div className="flex justify-center py-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Candidaturas" value={orbtyStats.total} />
              <MetricCard label="Aceites" value={orbtyStats.accepted} />
              <MetricCard label="Pendentes" value={orbtyStats.pending} />
              <MetricCard label="Rejeitadas" value={orbtyStats.rejected} />
            </div>
          )}
        </GlassCard>

        {/* ========= Modal Editar Perfil (tudo em 1) ========= */}
        {editOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => (saving ? null : setEditOpen(false))} />
            <div className="relative w-full md:max-w-lg rounded-t-3xl md:rounded-3xl border border-border/50 bg-background p-5 max-h-[85vh] overflow-auto">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">Editar perfil</div>
                <button className="p-2 rounded-xl hover:bg-white/5" onClick={() => (saving ? null : setEditOpen(false))}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-6">
                {/* Básico */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest">
                    <UserRound className="w-4 h-4 text-primary" />
                    Informações
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">@instagram</Label>
                    <Input
                      value={form.instagram}
                      onChange={(e) => setForm((s) => ({ ...s, instagram: e.target.value }))}
                      placeholder="@seuinstagram"
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Seguidores</Label>
                    <Input
                      value={form.followers}
                      onChange={(e) => setForm((s) => ({ ...s, followers: e.target.value }))}
                      placeholder="Ex: 12000"
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Bio</Label>
                    <Input
                      value={form.bio}
                      onChange={(e) => setForm((s) => ({ ...s, bio: e.target.value }))}
                      placeholder="Descreva seu conteúdo..."
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Bairro</Label>
                    <Input
                      value={form.neighborhood}
                      onChange={(e) => setForm((s) => ({ ...s, neighborhood: e.target.value }))}
                      placeholder="Ex: Pinheiros"
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* Estilos (até 3) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest">
                      <Sparkles className="w-4 h-4 text-primary" />
                      Estilos (até 3)
                    </div>
                    <div className="text-[10px] text-muted-foreground">{form.contentStyles.length}/3</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {stylesCatalog.map((s) => {
                      const active = form.contentStyles.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleToggleStyle(s)}
                          className={`text-xs px-3 py-2 rounded-full border transition ${
                            active
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-border/50 bg-white/5 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Audiência */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Audiência
                  </div>

                  {/* Gênero */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Gênero (masculino / feminino)</Label>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Feminino: {form.audienceGender.female}%</span>
                      <span>Masculino: {form.audienceGender.male}%</span>
                    </div>
                    <Slider
                      value={[form.audienceGender.female]}
                      onValueChange={(v) => setAudienceFemale(v[0])}
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>

                  {/* Faixa etária fixa */}
                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground">Faixa etária (0–100)</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {AGE_KEYS.map((k) => (
                        <div key={k} className="rounded-2xl border border-border/50 bg-white/5 p-3">
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">{k}</div>
                            <div className="text-xs text-foreground font-medium">{form.audienceAge[k]}%</div>
                          </div>
                          <div className="mt-2">
                            <Slider
                              value={[form.audienceAge[k]]}
                              onValueChange={(v) =>
                                setForm((s) => ({
                                  ...s,
                                  audienceAge: { ...s.audienceAge, [k]: clamp(v[0], 0, 100) },
                                }))
                              }
                              min={0}
                              max={100}
                              step={1}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      * Por enquanto editável manualmente. Futuro: integração Meta.
                    </div>
                  </div>

                  {/* Cidades */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-xs text-muted-foreground">Principais cidades (até 6)</Label>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((s) => {
                            if (s.audienceCities.length >= 6) return s;
                            return { ...s, audienceCities: [...s.audienceCities, { city: "", pct: 0 }] };
                          })
                        }
                        className="text-xs px-3 py-2 rounded-xl border border-border/50 bg-white/5 text-muted-foreground hover:text-foreground inline-flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar
                      </button>
                    </div>

                    <div className="space-y-2">
                      {form.audienceCities.map((row, idx) => (
                        <div key={idx} className="rounded-2xl border border-border/50 bg-white/5 p-3">
                          <div className="grid grid-cols-5 gap-2 items-center">
                            <div className="col-span-3">
                              <Input
                                value={row.city}
                                onChange={(e) =>
                                  setForm((s) => {
                                    const next = [...s.audienceCities];
                                    next[idx] = { ...next[idx], city: e.target.value };
                                    return { ...s, audienceCities: next };
                                  })
                                }
                                placeholder="Cidade"
                                className="text-sm"
                              />
                            </div>
                            <div className="col-span-1">
                              <Input
                                value={String(row.pct)}
                                onChange={(e) =>
                                  setForm((s) => {
                                    const next = [...s.audienceCities];
                                    next[idx] = { ...next[idx], pct: clamp(Number(e.target.value || 0), 0, 100) };
                                    return { ...s, audienceCities: next };
                                  })
                                }
                                placeholder="%"
                                className="text-sm"
                              />
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  setForm((s) => ({
                                    ...s,
                                    audienceCities: s.audienceCities.filter((_, i) => i !== idx),
                                  }))
                                }
                                className="p-2 rounded-xl border border-border/50 bg-white/5 text-muted-foreground hover:text-foreground"
                                title="Remover"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="w-full py-3 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-sm glow-blue flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}