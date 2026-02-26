import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  Eye,
  Pencil,
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

/** ---------------------------
 *  Audience helpers (SYNC)
 *  Campo usado: profiles.audience_gender (Json)
 *  Novo formato:
 *  { gender: {...}, age: {...}, cities: {...} }
 *  Compatível com legado: { female: 60, male: 40 } ou { Feminino: 60, Masculino: 40 }
 * --------------------------- */

type AudienceMap = Record<string, number>;
type AudienceStructured = { gender: AudienceMap | null; age: AudienceMap | null; cities: AudienceMap | null };

const parseAudienceMap = (obj: any): AudienceMap | null => {
  if (!obj || typeof obj !== "object") return null;
  const out: AudienceMap = {};
  for (const [k, v] of Object.entries(obj)) {
    const num = Number(v);
    if (!Number.isNaN(num)) out[String(k)] = num;
  }
  return Object.keys(out).length ? out : null;
};

const parseAudienceStructured = (raw: any): AudienceStructured => {
  if (!raw || typeof raw !== "object") return { gender: null, age: null, cities: null };

  const hasStructured =
    Object.prototype.hasOwnProperty.call(raw, "gender") ||
    Object.prototype.hasOwnProperty.call(raw, "age") ||
    Object.prototype.hasOwnProperty.call(raw, "cities");

  if (hasStructured) {
    return {
      gender: parseAudienceMap((raw as any).gender),
      age: parseAudienceMap((raw as any).age),
      cities: parseAudienceMap((raw as any).cities),
    };
  }

  // legado (ex.: { female: 60, male: 40 })
  const maybeFemale = (raw as any).female;
  const maybeMale = (raw as any).male;
  if (typeof maybeFemale === "number" || typeof maybeMale === "number") {
    const female = typeof maybeFemale === "number" ? maybeFemale : 50;
    const male = typeof maybeMale === "number" ? maybeMale : 50;
    return { gender: { Feminino: female, Masculino: male }, age: null, cities: null };
  }

  // legado genérico (objeto simples => assume gender)
  return { gender: parseAudienceMap(raw), age: null, cities: null };
};

const mergeGenderIntoAudience = (existing: any, femalePct: number, malePct: number) => {
  const prev = parseAudienceStructured(existing);
  const next: AudienceStructured = {
    ...prev,
    gender: { Feminino: femalePct, Masculino: malePct },
  };
  return {
    gender: next.gender ?? null,
    age: next.age ?? null,
    cities: next.cities ?? null,
  };
};

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

  const fallbackFollowers = useMemo(() => {
    const raw = (profile as any)?.followers as string | undefined;
    if (!raw) return null;
    const onlyDigits = raw.replace(/[^\d]/g, "");
    if (!onlyDigits) return null;
    const n = Number(onlyDigits);
    return Number.isFinite(n) ? n : null;
  }, [profile]);

  const fallbackAudience = useMemo(() => {
    const ag = (profile as any)?.audience_gender;
    const parsed = parseAudienceStructured(ag);
    const g = parsed.gender;
    // tenta pegar valores do formato novo (Feminino/Masculino), ou fallback 50/50
    const female =
      typeof (g as any)?.Feminino === "number"
        ? (g as any).Feminino
        : typeof (ag as any)?.female === "number"
          ? (ag as any).female
          : 50;
    const male =
      typeof (g as any)?.Masculino === "number"
        ? (g as any).Masculino
        : typeof (ag as any)?.male === "number"
          ? (ag as any).male
          : 50;
    return { female, male };
  }, [profile]);

  const instagram = useMemo(() => {
    const rpcIg = ctx.data?.instagram;
    if (rpcIg) return rpcIg;

    return {
      platform: "instagram",
      source: "self_reported",
      instagram_username: (profile as any)?.instagram ?? null,
      followers_count: fallbackFollowers,
      audience_female_pct: fallbackAudience.female,
      audience_male_pct: fallbackAudience.male,
      audience_region: null,
      collected_at: null,
    };
  }, [ctx.data, profile, fallbackFollowers, fallbackAudience]);

  const [orbtyStats, setOrbtyStats] = useState<{
    total: number;
    accepted: number;
    pending: number;
    rejected: number;
  }>({ total: 0, accepted: 0, pending: 0, rejected: 0 });

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
  }, [profile?.id, ctx.data?.influencer_metrics]);

  // ---------------------------
  // Modal IG (mantém)
  // ---------------------------
  const [igOpen, setIgOpen] = useState(false);
  const [igSaving, setIgSaving] = useState(false);

  const [igForm, setIgForm] = useState(() => ({
    instagram_username: (profile as any)?.instagram ?? "",
    followers_count: instagram?.followers_count ?? 0,
    audience_female_pct: Number(instagram?.audience_female_pct ?? 50),
    audience_region: instagram?.audience_region ?? "",
  }));

  useEffect(() => {
    setIgForm({
      instagram_username: (profile as any)?.instagram ?? "",
      followers_count: instagram?.followers_count ?? 0,
      audience_female_pct: Number(instagram?.audience_female_pct ?? 50),
      audience_region: instagram?.audience_region ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [igOpen]);

  const handleSaveIg = async () => {
    const female = igForm.audience_female_pct;
    const male = 100 - female;

    if (igForm.followers_count < 0) {
      toast.error("Seguidores inválido.");
      return;
    }

    setIgSaving(true);
    try {
      // 1) salva métricas via serviço (como já faz)
      await updateMyInstagramStats({
        instagram_username: igForm.instagram_username,
        followers_count: igForm.followers_count,
        audience_female_pct: female,
        audience_male_pct: male,
        audience_region: igForm.audience_region || undefined,
      });

      // 2) garante sync no profiles.audience_gender SEM apagar cities/age
      //    (merge do gender)
      if (profile?.id) {
        const existing = (profile as any)?.audience_gender ?? null;
        const merged = mergeGenderIntoAudience(existing, female, male);

        const { error } = await supabase
          .from("profiles")
          .update({
            instagram: igForm.instagram_username || null,
            followers: String(igForm.followers_count ?? "") || null,
            audience_gender: merged,
          })
          .eq("id", profile.id);

        if (error) {
          console.error("SYNC_AUDIENCE_GENDER_ERROR", error);
          // não falha o fluxo, mas avisa
          toast.message("Salvou IG, mas não sincronizou audiência do perfil.", { description: "Verifique permissões/RLS." });
        }
      }

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

  // ---------------------------
  // Modal Editar Perfil (dados básicos)
  // ---------------------------
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const [editForm, setEditForm] = useState(() => ({
    name: (profile as any)?.name ?? "",
    city: (profile as any)?.city ?? "",
    state: (profile as any)?.state ?? "",
    neighborhood: (profile as any)?.neighborhood ?? "",
    bio: (profile as any)?.bio ?? "",
    content_style: (profile as any)?.content_style ?? "",
    instagram: (profile as any)?.instagram ?? "",
  }));

  useEffect(() => {
    if (!editOpen) return;
    setEditForm({
      name: (profile as any)?.name ?? "",
      city: (profile as any)?.city ?? "",
      state: (profile as any)?.state ?? "",
      neighborhood: (profile as any)?.neighborhood ?? "",
      bio: (profile as any)?.bio ?? "",
      content_style: (profile as any)?.content_style ?? "",
      instagram: (profile as any)?.instagram ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOpen]);

  const handleSaveProfileBasics = async () => {
    if (!profile?.id) return;

    if (!editForm.name.trim()) return toast.error("Nome é obrigatório.");
    if (!editForm.city.trim() || !editForm.state.trim()) return toast.error("Cidade e Estado são obrigatórios.");

    setEditSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: editForm.name.trim(),
          city: editForm.city.trim(),
          state: editForm.state.trim(),
          neighborhood: editForm.neighborhood.trim() || null,
          bio: editForm.bio.trim() || null,
          content_style: editForm.content_style || null,
          instagram: editForm.instagram.trim() || null,
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast.success("Perfil atualizado!");
      setEditOpen(false);
      await ctx.refetch();
      await refreshProfile();
    } catch (e: any) {
      console.error("SAVE_PROFILE_BASICS_ERROR", e);
      toast.error(e?.message || "Erro ao salvar perfil.");
    } finally {
      setEditSaving(false);
    }
  };

  // ---------------------------
  // Modal Editar Audiência Pública (cities/gender/age)
  // ---------------------------
  type AudienceKey = "cities" | "gender" | "age";
  const [audOpen, setAudOpen] = useState(false);
  const [audSaving, setAudSaving] = useState(false);

  const [audDraft, setAudDraft] = useState<AudienceStructured>(() => parseAudienceStructured((profile as any)?.audience_gender));

  useEffect(() => {
    if (!audOpen) return;
    setAudDraft(parseAudienceStructured((profile as any)?.audience_gender));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audOpen]);

  const addAudItem = (k: AudienceKey) => {
    const placeholders: Record<AudienceKey, string> = {
      cities: "Ex: São Paulo",
      gender: "Ex: Feminino",
      age: "Ex: 18–24",
    };

    setAudDraft((prev) => {
      const current = prev[k] ? { ...(prev[k] as AudienceMap) } : {};
      let key = placeholders[k];
      let i = 2;
      while (Object.prototype.hasOwnProperty.call(current, key)) key = `${placeholders[k]} ${i++}`;
      current[key] = 0;
      return { ...prev, [k]: current };
    });
  };

  const renameAudKey = (k: AudienceKey, oldKey: string, newKey: string) => {
    setAudDraft((prev) => {
      const current = prev[k] ? { ...(prev[k] as AudienceMap) } : {};
      const val = current[oldKey];
      delete current[oldKey];
      if (newKey.trim()) current[newKey.trim()] = Number(val ?? 0);
      return { ...prev, [k]: Object.keys(current).length ? current : null };
    });
  };

  const setAudValue = (k: AudienceKey, key: string, value: number) => {
    setAudDraft((prev) => {
      const current = prev[k] ? { ...(prev[k] as AudienceMap) } : {};
      current[key] = Number.isFinite(value) ? value : 0;
      return { ...prev, [k]: current };
    });
  };

  const removeAudItem = (k: AudienceKey, key: string) => {
    setAudDraft((prev) => {
      const current = prev[k] ? { ...(prev[k] as AudienceMap) } : {};
      delete current[key];
      return { ...prev, [k]: Object.keys(current).length ? current : null };
    });
  };

  const saveAudiencePublic = async () => {
    if (!profile?.id) return;

    setAudSaving(true);
    try {
      const payload = {
        gender: audDraft.gender ?? null,
        age: audDraft.age ?? null,
        cities: audDraft.cities ?? null,
      };

      const { error } = await supabase.from("profiles").update({ audience_gender: payload }).eq("id", profile.id);

      if (error) throw error;

      toast.success("Audiência pública atualizada!");
      setAudOpen(false);
      await ctx.refetch();
      await refreshProfile();
    } catch (e: any) {
      console.error("SAVE_AUDIENCE_PUBLIC_ERROR", e);
      toast.error(e?.message || "Erro ao salvar audiência.");
    } finally {
      setAudSaving(false);
    }
  };

  const renderAudSection = (k: AudienceKey, title: string) => {
    const map = (audDraft[k] || {}) as AudienceMap;
    const entries = Object.entries(map);

    return (
      <div className="rounded-2xl border border-border/50 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <button
            type="button"
            onClick={() => addAudItem(k)}
            className="rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4 text-primary" />
            Adicionar
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="text-xs text-muted-foreground mt-2">Sem dados. Adicione itens para aparecer no perfil público.</div>
        ) : (
          <div className="mt-3 space-y-2">
            {entries.map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <Input
                  value={key}
                  onChange={(e) => renameAudKey(k, key, e.target.value)}
                  className="text-sm"
                />
                <Input
                  type="number"
                  value={Number(value)}
                  onChange={(e) => setAudValue(k, key, Number(e.target.value || 0))}
                  className="text-sm w-28"
                />
                <button
                  type="button"
                  onClick={() => removeAudItem(k, key)}
                  className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="text-[11px] text-muted-foreground">
              Pode ser % ou valor absoluto. O público exibirá como proporção em gráfico (donut).
            </div>
          </div>
        )}
      </div>
    );
  };

  const navType = "influencer";

  const followersLabel =
    instagram?.followers_count === null || instagram?.followers_count === undefined
      ? "—"
      : Number(instagram.followers_count).toLocaleString("pt-BR");

  const femaleLabel =
    instagram?.audience_female_pct === null || instagram?.audience_female_pct === undefined
      ? "—"
      : `${Number(instagram.audience_female_pct).toFixed(0)}%`;

  const maleLabel =
    instagram?.audience_male_pct === null || instagram?.audience_male_pct === undefined
      ? "—"
      : `${Number(instagram.audience_male_pct).toFixed(0)}%`;

  const igHandle = (profile as any)?.instagram ?? null;

  return (
    <MobileLayout title="Meu perfil" showBack navType={navType}>
      <div className="px-6 py-6 space-y-6">
        <GlassCard className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                {/* ✅ Avatar */}
                <div className="relative">
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

                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-semibold text-foreground">{profile?.name || "Creator"}</div>
                    {isVerifiedInfluencer && <VerifiedBadge size="sm" />}
                  </div>

                  {/* ✅ @ clicável */}
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
                </div>
              </div>

              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>{profile ? `${profile.city}, ${profile.state}` : "—"}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => setEditOpen(true)}
                className="rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition flex items-center gap-2"
              >
                <Pencil className="w-4 h-4 text-primary" />
                Editar perfil
              </button>

              <button
                onClick={() => setAudOpen(true)}
                className="rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4 text-primary" />
                Audiência pública
              </button>

              <button
                onClick={() => setIgOpen(true)}
                className="rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-primary" />
                Atualizar IG
              </button>

              {/* ✅ Ver perfil público */}
              {profile?.id ? (
                <button
                  onClick={() => navigate(`/u/${profile.id}`)}
                  className="rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition flex items-center gap-2"
                >
                  <Eye className="w-4 h-4 text-primary" />
                  Ver perfil público
                </button>
              ) : null}
            </div>
          </div>
        </GlassCard>

        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Seguidores" value={followersLabel} icon={<Users className="w-4 h-4 text-primary" />} />
          <MetricCard
            label="Região do público"
            value={instagram?.audience_region || "—"}
            icon={<MapPin className="w-4 h-4 text-accent" />}
          />
          <MetricCard label="Público feminino" value={femaleLabel} />
          <MetricCard label="Público masculino" value={maleLabel} />
        </div>

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

        {/* ---------------------------
            MODAL: EDITAR PERFIL
        --------------------------- */}
        {editOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => (editSaving ? null : setEditOpen(false))} />
            <div className="relative w-full md:max-w-md rounded-t-3xl md:rounded-3xl border border-border/50 bg-background p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">Editar perfil</div>
                <button className="p-2 rounded-xl hover:bg-white/5" onClick={() => (editSaving ? null : setEditOpen(false))}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nome *</Label>
                  <Input value={editForm.name} onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))} className="text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Cidade *</Label>
                    <Input value={editForm.city} onChange={(e) => setEditForm((s) => ({ ...s, city: e.target.value }))} className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Estado *</Label>
                    <Input value={editForm.state} onChange={(e) => setEditForm((s) => ({ ...s, state: e.target.value }))} className="text-sm" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Bairro</Label>
                  <Input value={editForm.neighborhood} onChange={(e) => setEditForm((s) => ({ ...s, neighborhood: e.target.value }))} className="text-sm" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Bio</Label>
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm((s) => ({ ...s, bio: e.target.value }))}
                    className="w-full min-h-[90px] rounded-xl border border-border/50 bg-background px-3 py-2 text-sm text-foreground focus:outline-none"
                    placeholder="Conte sobre você e seu conteúdo"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Categoria do conteúdo</Label>
                  <select
                    value={editForm.content_style}
                    onChange={(e) => setEditForm((s) => ({ ...s, content_style: e.target.value }))}
                    className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm text-foreground focus:outline-none"
                  >
                    <option value="">Selecione</option>
                    {CONTENT_STYLE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Instagram</Label>
                  <Input value={editForm.instagram} onChange={(e) => setEditForm((s) => ({ ...s, instagram: e.target.value }))} className="text-sm" placeholder="@seuinstagram" />
                </div>

                <button
                  onClick={handleSaveProfileBasics}
                  disabled={editSaving}
                  className="w-full py-3 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-sm glow-blue flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editSaving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------
            MODAL: AUDIÊNCIA PÚBLICA
        --------------------------- */}
        {audOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => (audSaving ? null : setAudOpen(false))} />
            <div className="relative w-full md:max-w-md rounded-t-3xl md:rounded-3xl border border-border/50 bg-background p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">Audiência pública (temporário)</div>
                <button className="p-2 rounded-xl hover:bg-white/5" onClick={() => (audSaving ? null : setAudOpen(false))}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 text-xs text-muted-foreground">
                Esses dados aparecem no seu perfil público para o contratante. No futuro, você poderá conectar com a Meta para
                puxar automaticamente.
              </div>

              <div className="mt-4 space-y-3">
                {renderAudSection("cities", "Principais cidades")}
                {renderAudSection("gender", "Gênero")}
                {renderAudSection("age", "Faixa etária")}

                <button
                  onClick={saveAudiencePublic}
                  disabled={audSaving}
                  className="w-full py-3 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-sm glow-blue flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {audSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {audSaving ? "Salvando..." : "Salvar audiência"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------
            MODAL: IG
        --------------------------- */}
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

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Público (gênero)</Label>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Feminino: {igForm.audience_female_pct}%</span>
                    <span>Masculino: {100 - igForm.audience_female_pct}%</span>
                  </div>
                  <Slider
                    value={[igForm.audience_female_pct]}
                    onValueChange={(v) => setIgForm((s) => ({ ...s, audience_female_pct: v[0] }))}
                    min={0}
                    max={100}
                    step={1}
                  />
                  <div className="text-[11px] text-muted-foreground">
                    Ao salvar, isso também sincroniza o <b>Gênero</b> da audiência pública (sem apagar cidades/idade).
                  </div>
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