import { useEffect, useMemo, useRef, useState } from "react";
import MobileLayout from "@/components/MobileLayout";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useMyProfileContext } from "@/hooks/useMyProfileContext";
import { updateOrganizationLogoWithUpload } from "@/services/organizationLogo";
import { createMyOrganization } from "@/services/profile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  MapPin,
  Megaphone,
  CheckCircle2,
  CircleDot,
  FileText,
  Trash2,
  ImagePlus,
  Building2,
  Pencil,
  Save,
  X,
  Globe,
  Tag,
  Package,
  Eye,
  ExternalLink,
  Sparkles,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";

function MetricCard(props: { label: string; value: React.ReactNode; icon?: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{props.label}</div>
          {props.hint ? <div className="text-[10px] text-muted-foreground/70 mt-0.5">{props.hint}</div> : null}
        </div>
        {props.icon}
      </div>
      <div className="mt-2 text-xl font-semibold text-foreground">{props.value}</div>
    </div>
  );
}

function GlassCard(props: { children: React.ReactNode; className?: string }) {
  return <div className={`glass-card p-5 ${props.className ?? ""}`}>{props.children}</div>;
}

function safeUrl(url?: string | null) {
  const raw = (url || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export default function ContractorProfile() {
  const navigate = useNavigate();

  // ⚠️ Mantém compatível: se seu useAuth não tiver userRole/approvalStatus, não quebra
  const auth = useAuth() as any;
  const profile = auth?.profile;
  const userRole = auth?.userRole;
  const approvalStatus = auth?.approvalStatus;

  const ctx = useMyProfileContext();
  const org = ctx.data?.organization;

  const isVerifiedContractor = userRole === "contractor" && approvalStatus === "approved";

  // Upload logo
  const logoRef = useRef<HTMLInputElement | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const handlePickLogo = () => {
    if (!org?.id) {
      toast.error("Crie o perfil do negócio antes de enviar o logo.");
      return;
    }
    logoRef.current?.click();
  };

  const handleLogoFile = async (file?: File | null) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 5MB.");
      return;
    }

    if (!org?.id) {
      toast.error("Organização ainda não criada.");
      return;
    }

    setLogoUploading(true);
    try {
      await updateOrganizationLogoWithUpload(org.id, file);
      toast.success("Logo atualizado!");
      await ctx.refetch();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar logo.");
    } finally {
      setLogoUploading(false);
      if (logoRef.current) logoRef.current.value = "";
    }
  };

  // Métricas campanhas
  const [metrics, setMetrics] = useState<{
    total: number;
    active: number;
    completed: number;
    closed: number;
    draft: number;
    deleted: number;
  }>({ total: 0, active: 0, completed: 0, closed: 0, draft: 0, deleted: 0 });

  const [loadingMetrics, setLoadingMetrics] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoadingMetrics(true);

      const m = ctx.data?.organization_metrics;
      if (m) {
        if (!alive) return;
        setMetrics({
          total: Number(m.total_campaigns ?? 0),
          active: Number(m.active_campaigns ?? 0),
          completed: Number(m.completed_campaigns ?? 0),
          closed: Number(m.closed_campaigns ?? 0),
          draft: Number(m.draft_campaigns ?? 0),
          deleted: Number(m.deleted_campaigns ?? 0),
        });
        setLoadingMetrics(false);
        return;
      }

      // fallback
      try {
        const { data, error } = await supabase.rpc("get_my_campaigns" as any);
        if (!alive) return;

        if (error) {
          console.error(error);
          setLoadingMetrics(false);
          return;
        }

        const list = (data || []) as any[];
        const notDeleted = list.filter((c) => !c.deleted_at && c.status !== "deleted");

        const total = notDeleted.length;
        const active = notDeleted.filter((c) => c.status === "active").length;
        const completed = notDeleted.filter((c) => c.status === "completed").length;
        const closed = notDeleted.filter((c) => c.status === "closed_manual" || c.status === "closed_expired").length;
        const draft = notDeleted.filter((c) => c.status === "draft").length;
        const deleted = list.length - notDeleted.length;

        setMetrics({ total, active, completed, closed, draft, deleted });
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoadingMetrics(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [ctx.data?.organization_metrics]);

  // Modal Criar/Editar Negócio
  const [orgOpen, setOrgOpen] = useState(false);
  const [orgSaving, setOrgSaving] = useState(false);

  const [orgForm, setOrgForm] = useState({
    name: "",
    region_city: "",
    region_state: "",
    business_category: "",
    product_or_brand: "",
    website_url: "",
  });

  useEffect(() => {
    if (!orgOpen) return;

    setOrgForm({
      name: org?.name ?? "",
      region_city: org?.region_city ?? profile?.city ?? "",
      region_state: org?.region_state ?? profile?.state ?? "",
      business_category: org?.business_category ?? "",
      product_or_brand: org?.product_or_brand ?? "",
      website_url: org?.website_url ?? "",
    });
  }, [orgOpen, org, profile?.city, profile?.state]);

  const isEditingOrg = !!org?.id;

  const handleSaveOrg = async () => {
    if (!orgForm.name.trim()) {
      toast.error("Nome do negócio é obrigatório.");
      return;
    }

    setOrgSaving(true);
    try {
      if (!isEditingOrg) {
        await createMyOrganization({
          name: orgForm.name.trim(),
          region_city: orgForm.region_city.trim() || undefined,
          region_state: orgForm.region_state.trim() || undefined,
          business_category: orgForm.business_category.trim() || undefined,
          product_or_brand: orgForm.product_or_brand.trim() || undefined,
          website_url: orgForm.website_url.trim() || undefined,
        });

        toast.success("Negócio criado!");
      } else {
        const { error } = await supabase
          .from("organizations")
          .update({
            name: orgForm.name.trim(),
            region_city: orgForm.region_city.trim() || null,
            region_state: orgForm.region_state.trim() || null,
            business_category: orgForm.business_category.trim() || null,
            product_or_brand: orgForm.product_or_brand.trim() || null,
            website_url: orgForm.website_url.trim() || null,
          })
          .eq("id", org.id);

        if (error) throw error;

        toast.success("Negócio atualizado!");
      }

      setOrgOpen(false);
      await ctx.refetch();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar negócio.");
    } finally {
      setOrgSaving(false);
    }
  };

  const title = useMemo(() => org?.name || profile?.name || "Meu negócio", [org?.name, profile?.name]);

  const locationLabel = useMemo(() => {
    const city = org?.region_city || profile?.city;
    const state = org?.region_state || profile?.state;
    if (city && state) return `${city}, ${state}`;
    if (city) return city;
    return "—";
  }, [org?.region_city, org?.region_state, profile?.city, profile?.state]);

  const website = useMemo(() => safeUrl(org?.website_url), [org?.website_url]);

  const openWebsite = () => {
    if (!website) return;
    window.open(website, "_blank", "noopener,noreferrer");
  };

  const openMaps = () => {
    const q = encodeURIComponent(locationLabel || "");
    if (!q) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener,noreferrer");
  };

  const navType = "contractor";

  return (
    <MobileLayout title="Perfil do contratante" showBack navType={navType}>
      <div className="px-6 py-6 space-y-6">
        {/* =========================
            HERO / HEADER PREMIUM
        ========================= */}
        <GlassCard>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-3">
                {/* Logo */}
                {org?.logo_url ? (
                  <div className="w-14 h-14 rounded-2xl overflow-hidden border border-primary/20 bg-white/5 shrink-0">
                    <img
                      src={org.logo_url}
                      alt="Logo"
                      className="w-full h-full object-cover block"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-border/50 flex items-center justify-center shrink-0">
                    <Building2 className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-lg font-semibold text-foreground truncate">{title}</div>
                    {isVerifiedContractor ? <VerifiedBadge size="sm" /> : null}

                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-card/60 text-muted-foreground inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Orbty Business
                    </span>
                  </div>

                  <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{locationLabel}</span>
                  </div>
                </div>
              </div>

              {(org?.business_category || org?.product_or_brand) && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {org?.business_category ? (
                    <span className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-full border border-border/50 bg-card/60 text-foreground">
                      <Tag className="w-4 h-4 text-primary" />
                      {org.business_category}
                    </span>
                  ) : null}

                  {org?.product_or_brand ? (
                    <span className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-full border border-border/50 bg-card/60 text-foreground">
                      <Package className="w-4 h-4 text-accent" />
                      {org.product_or_brand}
                    </span>
                  ) : null}
                </div>
              )}

              {website ? (
                <button
                  type="button"
                  onClick={openWebsite}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:opacity-90 transition-opacity"
                  title="Abrir site"
                >
                  <Globe className="w-4 h-4" />
                  <span className="underline truncate">{website}</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              ) : null}
            </div>

            {/* Ações */}
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => setOrgOpen(true)}
                className="rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition flex items-center gap-2"
              >
                {org ? <Pencil className="w-4 h-4 text-primary" /> : <Building2 className="w-4 h-4 text-primary" />}
                {org ? "Editar negócio" : "Criar negócio"}
              </button>

              <button
                onClick={handlePickLogo}
                disabled={logoUploading || !org?.id}
                className="rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition flex items-center gap-2 disabled:opacity-60"
              >
                {logoUploading ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                ) : (
                  <ImagePlus className="w-4 h-4 text-primary" />
                )}
                Trocar logo
              </button>

              {/* Ver perfil público (usa /u/:id - não cria rota nova) */}
              {profile?.id ? (
                <button
                  onClick={() => navigate(`/u/${profile.id}`)}
                  className="rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition flex items-center gap-2"
                >
                  <Eye className="w-4 h-4 text-primary" />
                  Ver perfil público
                </button>
              ) : null}

              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleLogoFile(e.target.files?.[0])}
              />
            </div>
          </div>

          {!org && (
            <div className="mt-3 text-xs text-muted-foreground">
              Para exibir o negócio completo e permitir envio de logo, crie o perfil do seu negócio acima.
            </div>
          )}
        </GlassCard>

        {/* =========================
            QUICK CARDS (100% clicáveis)
        ========================= */}
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={openMaps}
            className="rounded-2xl border border-border/50 bg-card/60 hover:bg-card/80 p-3 text-left transition"
            title="Abrir no Maps"
          >
            <div className="flex items-center justify-between">
              <MapPin className="w-4 h-4 text-primary" />
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Localização</p>
            <p className="text-sm font-semibold text-foreground truncate">{locationLabel}</p>
          </button>

          <button
            type="button"
            onClick={openWebsite}
            disabled={!website}
            className={`rounded-2xl border p-3 text-left transition ${
              website ? "border-border/50 bg-card/60 hover:bg-card/80" : "border-border/30 bg-card/40 opacity-70"
            }`}
            title={website ? "Abrir site" : "Site não informado"}
          >
            <div className="flex items-center justify-between">
              <Globe className="w-4 h-4 text-primary" />
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Site</p>
            <p className="text-sm font-semibold text-foreground truncate">{website || "—"}</p>
          </button>

          <button
            type="button"
            onClick={() => setOrgOpen(true)}
            className="rounded-2xl border border-border/50 bg-card/60 hover:bg-card/80 p-3 text-left transition"
            title={org ? "Editar negócio" : "Criar negócio"}
          >
            <div className="flex items-center justify-between">
              <Building2 className="w-4 h-4 text-primary" />
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Negócio</p>
            <p className="text-sm font-semibold text-foreground truncate">{org ? "Editar dados" : "Criar agora"}</p>
          </button>
        </div>

        {/* =========================
            MÉTRICAS
        ========================= */}
        <GlassCard className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">Performance na Orbty</div>
            <span className="text-[10px] px-2 py-1 rounded-full border border-border/50 bg-card/60 text-muted-foreground">
              campanhas
            </span>
          </div>

          {loadingMetrics ? (
            <div className="flex justify-center py-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Campanhas" value={metrics.total} icon={<Megaphone className="w-4 h-4 text-primary" />} />
              <MetricCard label="Ativas" value={metrics.active} icon={<CircleDot className="w-4 h-4 text-accent" />} />
              <MetricCard label="Concluídas" value={metrics.completed} icon={<CheckCircle2 className="w-4 h-4 text-primary" />} />
              <MetricCard label="Encerradas" value={metrics.closed} icon={<FileText className="w-4 h-4 text-muted-foreground" />} />
              <MetricCard label="Rascunhos" value={metrics.draft} hint="Não publicadas" />
              <MetricCard label="Excluídas" value={metrics.deleted} icon={<Trash2 className="w-4 h-4 text-destructive" />} />
            </div>
          )}
        </GlassCard>

        {/* Modal Criar/Editar negócio */}
        {orgOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => (orgSaving ? null : setOrgOpen(false))} />
            <div className="relative w-full md:max-w-md rounded-t-3xl md:rounded-3xl border border-border/50 bg-background p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">{isEditingOrg ? "Editar negócio" : "Criar negócio"}</div>
                <button
                  className="p-2 rounded-xl hover:bg-white/5"
                  onClick={() => (orgSaving ? null : setOrgOpen(false))}
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nome do negócio *</Label>
                  <Input
                    value={orgForm.name}
                    onChange={(e) => setOrgForm((s) => ({ ...s, name: e.target.value }))}
                    placeholder="Ex: Hamburgueria X"
                    className="text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Cidade</Label>
                    <Input
                      value={orgForm.region_city}
                      onChange={(e) => setOrgForm((s) => ({ ...s, region_city: e.target.value }))}
                      placeholder="Ex: Goiânia"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Estado</Label>
                    <Input
                      value={orgForm.region_state}
                      onChange={(e) => setOrgForm((s) => ({ ...s, region_state: e.target.value }))}
                      placeholder="Ex: GO"
                      className="text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Categoria</Label>
                  <Input
                    value={orgForm.business_category}
                    onChange={(e) => setOrgForm((s) => ({ ...s, business_category: e.target.value }))}
                    placeholder="Ex: Hamburgueria / Moda / Clínica"
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Produto/Marca</Label>
                  <Input
                    value={orgForm.product_or_brand}
                    onChange={(e) => setOrgForm((s) => ({ ...s, product_or_brand: e.target.value }))}
                    placeholder="Ex: Smash Burger / Coleção X"
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Site</Label>
                  <Input
                    value={orgForm.website_url}
                    onChange={(e) => setOrgForm((s) => ({ ...s, website_url: e.target.value }))}
                    placeholder="https://..."
                    className="text-sm"
                  />
                </div>

                <button
                  onClick={handleSaveOrg}
                  disabled={orgSaving}
                  className="w-full py-3 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-sm glow-blue flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {orgSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {orgSaving ? "Salvando..." : "Salvar"}
                </button>

                <div className="text-xs text-muted-foreground">
                  * Este perfil representa seu negócio para influenciadores e para a Orbty.
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