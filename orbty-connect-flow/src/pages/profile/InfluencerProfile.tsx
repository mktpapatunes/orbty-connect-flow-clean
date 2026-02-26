import { useState, useEffect, useMemo, useRef } from "react";
import MobileLayout from "@/components/MobileLayout";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useMyProfileContext } from "@/hooks/useMyProfileContext";
import { updateMyInstagramStats } from "@/services/profile";
import { updateMyAvatarWithUpload } from "@/services/profileAvatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Instagram, Users, MapPin, Save, X, Sparkles, Camera, ExternalLink, Eye } from "lucide-react";

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
    const female = typeof ag?.female === "number" ? ag.female : 50;
    const male = typeof ag?.male === "number" ? ag.male : 50;
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
      await updateMyInstagramStats({
        instagram_username: igForm.instagram_username,
        followers_count: igForm.followers_count,
        audience_female_pct: female,
        audience_male_pct: male,
        audience_region: igForm.audience_region || undefined,
      });

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
                {/* ✅ Avatar corrigido */}
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
          <MetricCard label="Região do público" value={instagram?.audience_region || "—"} icon={<MapPin className="w-4 h-4 text-accent" />} />
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