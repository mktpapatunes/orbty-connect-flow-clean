import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import MobileLayout from "@/components/MobileLayout";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useMyProfileContext } from "@/hooks/useMyProfileContext";
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
  Eye,
  Pencil,
  BarChart3,
  User as UserIcon,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type AudienceObj = Record<string, number>;

const AGE_BUCKETS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;

const CONTENT_STYLES = [
  "Lifestyle",
  "Moda",
  "Beleza",
  "Fitness",
  "Saúde",
  "Alimentação",
  "Gastronomia",
  "Viagem",
  "Maternidade",
  "Negócios",
  "Tecnologia",
  "Games",
  "Entretenimento",
  "Humor",
  "Educação",
  "Fotografia",
  "Esportes",
  "Pets",
  "Arte",
] as const;

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

function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeAudienceObj(obj: any): AudienceObj {
  if (!obj || typeof obj !== "object") return {};
  const out: AudienceObj = {};
  for (const [k, v] of Object.entries(obj)) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) out[String(k)] = n;
  }
  return out;
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function sumObj(obj: AudienceObj) {
  return Object.values(obj).reduce((a, b) => a + b, 0);
}

/**
 * Normaliza para % quando o usuário preenche qualquer coisa
 * - se soma 0 -> retorna tudo 0
 * - caso contrário, escala para 100 mantendo proporções
 */
function normalizeTo100(obj: AudienceObj): AudienceObj {
  const cleaned: AudienceObj = {};
  for (const [k, v] of Object.entries(obj)) cleaned[k] = Math.max(0, safeNum(v, 0));
  const total = sumObj(cleaned);
  if (total <= 0) return cleaned;

  const scaled: AudienceObj = {};
  for (const [k, v] of Object.entries(cleaned)) scaled[k] = (v / total) * 100;
  return scaled;
}

function topKey(obj: AudienceObj) {
  const entries = Object.entries(obj);
  if (!entries.length) return null;
  entries.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  return entries[0]?.[0] ?? null;
}

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

  // ======== Métricas Orbty (mantém como estava) ========
  const [orbtyStats, setOrbtyStats] = useState<{ total: number; accepted: number; pending: number; rejected: number }>({
    total: 0,
    accepted: 0,
    pending: 0,
    rejected: 0,
  });
  const [loadingOrbty, setLoadingOrbty] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!profile?.id) return;
      setLoadingOrbty(true);

      const rpcMetrics = ctx.data?.influencer_metrics;
      if (rpcMetrics) {
        if (!alive) return;
        setOrbtyStats({
          total: Number(rpcMetrics.total_applications ?? 0),
          accepted: Number(rpcMetrics.accepted_applications ?? 0),
          pending: Number(rpcMetrics.pending_applications ?? 0),
          rejected: Number(rpcMetrics.rejected_applications ?? 0),
        });
        setLoadingOrbty(false);
        return;
      }

      const { data, error } = await supabase.from("campaign_applications").select("status").eq("influencer_id", profile.id);

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
  }, [profile?.id, ctx.data?.influencer_metrics]);

  // ======== Valores atuais (do profiles) ========
  const igHandle = (profile as any)?.instagram ?? null;

  const followersCount = useMemo(() => {
    const raw = (profile as any)?.followers as string | undefined;
    if (!raw) return null;
    const onlyDigits = raw.replace(/[^\d]/g, "");
    if (!onlyDigits) return null;
    const n = Number(onlyDigits);
    return Number.isFinite(n) ? n : null;
  }, [profile]);

  const audienceGenderCurrent = useMemo(() => normalizeAudienceObj((profile as any)?.audience_gender), [profile]);
  const audienceAgeCurrent = useMemo(() => normalizeAudienceObj((profile as any)?.audience_age), [profile]);
  const audienceCitiesCurrent = useMemo(() => normalizeAudienceObj((profile as any)?.audience_cities), [profile]);

  const contentStyleCurrent = useMemo(() => {
    const raw = String((profile as any)?.content_style ?? "").trim();
    if (!raw) return [] as string[];
    // armazenamos como "A, B, C"
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }, [profile]);

  const followersLabel =
    followersCount === null || followersCount === undefined ? "—" : Number(followersCount).toLocaleString("pt-BR");

  // ======== Modal EDITAR PERFIL (tudo em um lugar) ========
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const [editForm, setEditForm] = useState(() => ({
    name: (profile as any)?.name ?? "",
    city: (profile as any)?.city ?? "",
    state: (profile as any)?.state ?? "",
    neighborhood: (profile as any)?.neighborhood ?? "",
    bio: (profile as any)?.bio ?? "",
    instagram: (profile as any)?.instagram ?? "",
    followers: followersCount ?? 0,

    // estilos (até 3)
    content_styles: contentStyleCurrent.slice(0, 3),

    // audiência
    gender_female: safeNum(audienceGenderCurrent.female, 50),
    gender_male: safeNum(audienceGenderCurrent.male, 50),

    // idade
    audience_age: {
      "18-24": safeNum(audienceAgeCurrent["18-24"], 0),
      "25-34": safeNum(audienceAgeCurrent["25-34"], 0),
      "35-44": safeNum(audienceAgeCurrent["35-44"], 0),
      "45-54": safeNum(audienceAgeCurrent["45-54"], 0),
      "55-64": safeNum(audienceAgeCurrent["55-64"], 0),
      "65+": safeNum(audienceAgeCurrent["65+"], 0),
    } as AudienceObj,

    // top cidades (3)
    city_1: topKey(audienceCitiesCurrent) ?? "",
    city_1_pct: safeNum(audienceCitiesCurrent[topKey(audienceCitiesCurrent) ?? ""], 0),

    city_2: "",
    city_2_pct: 0,

    city_3: "",
    city_3_pct: 0,
  }));

  // inicializa o form APENAS ao abrir (para não perder foco digitando)
  useEffect(() => {
    if (!editOpen) return;

    const citiesSorted = Object.entries(audienceCitiesCurrent)
      .map(([k, v]) => ({ k, v: safeNum(v, 0) }))
      .sort((a, b) => b.v - a.v);

    const c1 = citiesSorted[0]?.k ?? "";
    const c2 = citiesSorted[1]?.k ?? "";
    const c3 = citiesSorted[2]?.k ?? "";

    setEditForm({
      name: (profile as any)?.name ?? "",
      city: (profile as any)?.city ?? "",
      state: (profile as any)?.state ?? "",
      neighborhood: (profile as any)?.neighborhood ?? "",
      bio: (profile as any)?.bio ?? "",
      instagram: (profile as any)?.instagram ?? "",
      followers: followersCount ?? 0,
      content_styles: contentStyleCurrent.slice(0, 3),
      gender_female: clamp(safeNum(audienceGenderCurrent.female, 50), 0, 100),
      gender_male: clamp(safeNum(audienceGenderCurrent.male, 50), 0, 100),
      audience_age: {
        "18-24": safeNum(audienceAgeCurrent["18-24"], 0),
        "25-34": safeNum(audienceAgeCurrent["25-34"], 0),
        "35-44": safeNum(audienceAgeCurrent["35-44"], 0),
        "45-54": safeNum(audienceAgeCurrent["45-54"], 0),
        "55-64": safeNum(audienceAgeCurrent["55-64"], 0),
        "65+": safeNum(audienceAgeCurrent["65+"], 0),
      },
      city_1: c1,
      city_1_pct: citiesSorted[0]?.v ?? 0,
      city_2: c2,
      city_2_pct: citiesSorted[1]?.v ?? 0,
      city_3: c3,
      city_3_pct: citiesSorted[2]?.v ?? 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOpen]);

  const toggleStyle = (style: string) => {
    setEditForm((prev) => {
      const exists = prev.content_styles.includes(style);
      if (exists) {
        return { ...prev, content_styles: prev.content_styles.filter((s) => s !== style) };
      }
      if (prev.content_styles.length >= 3) {
        toast.error("Você pode escolher no máximo 3 estilos.");
        return prev;
      }
      return { ...prev, content_styles: [...prev.content_styles, style] };
    });
  };

  const buildCitiesObjFromForm = useCallback((): AudienceObj => {
    const obj: AudienceObj = {};
    const push = (name: string, pct: number) => {
      const key = (name || "").trim();
      const val = Math.max(0, safeNum(pct, 0));
      if (!key) return;
      obj[key] = val;
    };

    push(editForm.city_1, editForm.city_1_pct);
    push(editForm.city_2, editForm.city_2_pct);
    push(editForm.city_3, editForm.city_3_pct);

    // normaliza para 100 (opcional) — deixa proporcional.
    return normalizeTo100(obj);
  }, [editForm.city_1, editForm.city_1_pct, editForm.city_2, editForm.city_2_pct, editForm.city_3, editForm.city_3_pct]);

  const handleSaveProfile = async () => {
    if (!profile?.id) return;

    const name = editForm.name.trim();
    const city = editForm.city.trim();
    const state = editForm.state.trim();

    if (!name) return toast.error("Nome é obrigatório.");
    if (!city) return toast.error("Cidade é obrigatória.");
    if (!state) return toast.error("Estado é obrigatório.");

    const female = clamp(safeNum(editForm.gender_female, 0), 0, 100);
    const male = clamp(safeNum(editForm.gender_male, 0), 0, 100);

    // Se somar diferente de 100, normaliza mantendo proporção.
    const genderTotal = female + male;
    const genderObj =
      genderTotal <= 0
        ? { female: 0, male: 0 }
        : { female: (female / genderTotal) * 100, male: (male / genderTotal) * 100 };

    const ageObj = normalizeTo100(editForm.audience_age || {});
    const citiesObj = buildCitiesObjFromForm();

    const contentStyleStr = (editForm.content_styles || []).slice(0, 3).join(", ");

    setEditSaving(true);
    try {
      // salva em profiles (fonte da verdade do perfil público)
      const { error } = await supabase
        .from("profiles")
        .update({
          name,
          city,
          state,
          neighborhood: editForm.neighborhood.trim() || null,
          bio: editForm.bio.trim() || null,
          instagram: editForm.instagram.trim() || null,
          followers: String(Math.max(0, safeNum(editForm.followers, 0))) || null,
          content_style: contentStyleStr || null,

          audience_gender: genderObj,
          audience_age: ageObj,
          audience_cities: citiesObj,
        } as any)
        .eq("id", profile.id);

      if (error) throw error;

      toast.success("Perfil atualizado!");
      setEditOpen(false);

      await refreshProfile();
      await ctx.refetch();
    } catch (e: any) {
      console.error("SAVE_PROFILE_ERROR", e);
      toast.error(e?.message || "Erro ao salvar perfil.");
    } finally {
      setEditSaving(false);
    }
  };

  // ======== UI helpers ========
  const navType = "influencer";

  const locationLabel = profile ? `${profile.city}, ${profile.state}` : "—";

  return (
    <MobileLayout title="Meu perfil" showBack navType={navType}>
      <div className="px-6 py-6 space-y-6">
        {/* Header premium (layout corrigido: botões não estouram) */}
        <GlassCard className="p-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
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

                {/* Infos */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="text-lg font-semibold text-foreground truncate">
                      {profile?.name || "Creator"}
                    </div>
                    {isVerifiedInfluencer && <VerifiedBadge size="sm" />}
                  </div>

                  <div className="mt-1 text-sm text-muted-foreground flex items-center gap-2">
                    <Instagram className="w-4 h-4 shrink-0" />
                    {buildInstagramLinks(igHandle)?.raw ? (
                      <button
                        type="button"
                        onClick={() => openInstagram(igHandle)}
                        className="inline-flex items-center gap-1 text-primary hover:opacity-90 transition-opacity min-w-0"
                        title="Abrir Instagram"
                      >
                        <span className="truncate">@{buildInstagramLinks(igHandle)!.raw}</span>
                        <ExternalLink className="w-4 h-4 shrink-0" />
                      </button>
                    ) : (
                      <span className="truncate">Instagram não informado</span>
                    )}
                  </div>

                  <div className="mt-1 text-sm text-muted-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span className="truncate">{locationLabel}</span>
                  </div>
                </div>
              </div>

              {/* Ações (agora em coluna fixa e sem estourar) */}
              <div className="shrink-0 flex flex-col gap-2 items-end">
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4 text-primary" />
                  Editar perfil
                </button>

                {profile?.id ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/u/${profile.id}`)}
                    className="rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4 text-primary" />
                    Ver público
                  </button>
                ) : null}
              </div>
            </div>

            {/* Dica: verificado */}
            {!isVerifiedInfluencer && userRole === "influencer" && (
              <div className="text-xs text-muted-foreground">
                Seu selo de verificado aparece quando sua conta é aprovada pela Orbty.
              </div>
            )}
          </div>
        </GlassCard>

        {/* Métricas rápidas */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Seguidores" value={followersLabel} icon={<Users className="w-4 h-4 text-primary" />} />
          <MetricCard label="Estilos" value={(contentStyleCurrent.length ? contentStyleCurrent.join(" · ") : "—")} icon={<Sparkles className="w-4 h-4 text-accent" />} />
        </div>

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

        {/* ===== Modal Editar Perfil (tudo junto) ===== */}
        {editOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => (editSaving ? null : setEditOpen(false))} />
            <div className="relative w-full md:max-w-md rounded-t-3xl md:rounded-3xl border border-border/50 bg-background p-5 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-primary" />
                  Editar perfil
                </div>
                <button
                  type="button"
                  className="p-2 rounded-xl hover:bg-white/5"
                  onClick={() => (editSaving ? null : setEditOpen(false))}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-5">
                {/* Básico */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Nome *</Label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))}
                      className="text-sm"
                      placeholder="Seu nome"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Cidade *</Label>
                      <Input
                        value={editForm.city}
                        onChange={(e) => setEditForm((s) => ({ ...s, city: e.target.value }))}
                        className="text-sm"
                        placeholder="Ex: Goiânia"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Estado *</Label>
                      <Input
                        value={editForm.state}
                        onChange={(e) => setEditForm((s) => ({ ...s, state: e.target.value }))}
                        className="text-sm"
                        placeholder="Ex: GO"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Bairro</Label>
                    <Input
                      value={editForm.neighborhood}
                      onChange={(e) => setEditForm((s) => ({ ...s, neighborhood: e.target.value }))}
                      className="text-sm"
                      placeholder="Ex: Setor Bueno"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Bio</Label>
                    <textarea
                      value={editForm.bio}
                      onChange={(e) => setEditForm((s) => ({ ...s, bio: e.target.value }))}
                      className="w-full rounded-xl border border-border/50 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/30 min-h-[90px]"
                      placeholder="Escreva uma breve bio (pública)"
                    />
                  </div>
                </div>

                {/* Instagram + seguidores */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Instagram className="w-4 h-4 text-primary" />
                    <div className="text-sm font-semibold text-foreground">Instagram</div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">@instagram</Label>
                    <Input
                      value={editForm.instagram}
                      onChange={(e) => setEditForm((s) => ({ ...s, instagram: e.target.value }))}
                      className="text-sm"
                      placeholder="@seuinstagram"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Seguidores</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editForm.followers}
                      onChange={(e) => setEditForm((s) => ({ ...s, followers: Number(e.target.value || 0) }))}
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* Estilos (até 3) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <div className="text-sm font-semibold text-foreground">Estilo de conteúdo (até 3)</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {CONTENT_STYLES.map((st) => {
                      const active = editForm.content_styles.includes(st);
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => toggleStyle(st)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                            active
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-border/50 bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card/80"
                          }`}
                        >
                          {st}
                        </button>
                      );
                    })}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Selecionados:{" "}
                    <span className="text-foreground font-medium">
                      {editForm.content_styles.length ? editForm.content_styles.join(", ") : "—"}
                    </span>
                  </div>
                </div>

                {/* Audiência */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <div className="text-sm font-semibold text-foreground">Audiência (editável)</div>
                  </div>

                  {/* Gênero */}
                  <div className="rounded-2xl border border-border/50 bg-white/5 p-4 space-y-3">
                    <div className="text-xs text-muted-foreground font-medium">Gênero (%)</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Feminino</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={editForm.gender_female}
                          onChange={(e) =>
                            setEditForm((s) => ({ ...s, gender_female: Number(e.target.value || 0) }))
                          }
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Masculino</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={editForm.gender_male}
                          onChange={(e) =>
                            setEditForm((s) => ({ ...s, gender_male: Number(e.target.value || 0) }))
                          }
                          className="text-sm"
                        />
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      * Se não somar 100, a Orbty normaliza automaticamente ao salvar.
                    </div>
                  </div>

                  {/* Faixa etária */}
                  <div className="rounded-2xl border border-border/50 bg-white/5 p-4 space-y-3">
                    <div className="text-xs text-muted-foreground font-medium">Faixa etária (%)</div>
                    <div className="grid grid-cols-2 gap-3">
                      {AGE_BUCKETS.map((k) => (
                        <div key={k} className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">{k}</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={safeNum(editForm.audience_age?.[k], 0)}
                            onChange={(e) => {
                              const v = Number(e.target.value || 0);
                              setEditForm((s) => ({
                                ...s,
                                audience_age: { ...(s.audience_age || {}), [k]: v },
                              }));
                            }}
                            className="text-sm"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      * A Orbty normaliza para 100% ao salvar.
                    </div>
                  </div>

                  {/* Top cidades */}
                  <div className="rounded-2xl border border-border/50 bg-white/5 p-4 space-y-3">
                    <div className="text-xs text-muted-foreground font-medium">Principais cidades (Top 3)</div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-xs text-muted-foreground">Cidade 1</Label>
                        <Input
                          value={editForm.city_1}
                          onChange={(e) => setEditForm((s) => ({ ...s, city_1: e.target.value }))}
                          className="text-sm"
                          placeholder="Ex: São Paulo"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">%</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={editForm.city_1_pct}
                          onChange={(e) => setEditForm((s) => ({ ...s, city_1_pct: Number(e.target.value || 0) }))}
                          className="text-sm"
                        />
                      </div>

                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-xs text-muted-foreground">Cidade 2</Label>
                        <Input
                          value={editForm.city_2}
                          onChange={(e) => setEditForm((s) => ({ ...s, city_2: e.target.value }))}
                          className="text-sm"
                          placeholder="Ex: Rio de Janeiro"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">%</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={editForm.city_2_pct}
                          onChange={(e) => setEditForm((s) => ({ ...s, city_2_pct: Number(e.target.value || 0) }))}
                          className="text-sm"
                        />
                      </div>

                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-xs text-muted-foreground">Cidade 3</Label>
                        <Input
                          value={editForm.city_3}
                          onChange={(e) => setEditForm((s) => ({ ...s, city_3: e.target.value }))}
                          className="text-sm"
                          placeholder="Ex: Belo Horizonte"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">%</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={editForm.city_3_pct}
                          onChange={(e) => setEditForm((s) => ({ ...s, city_3_pct: Number(e.target.value || 0) }))}
                          className="text-sm"
                        />
                      </div>
                    </div>

                    <div className="text-[11px] text-muted-foreground">
                      * A Orbty normaliza para 100% ao salvar (proporcional).
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    * Por enquanto, a audiência é informada por você. No futuro, vamos integrar com Meta.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={editSaving}
                  className="w-full py-3 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-sm glow-blue flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editSaving ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
            </div>
          </div>
        )}

        {ctx.error && <div className="text-xs text-muted-foreground">Erro ao carregar contexto premium: {ctx.error}</div>}
      </div>
    </MobileLayout>
  );
}