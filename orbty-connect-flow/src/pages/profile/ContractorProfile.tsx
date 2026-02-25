import { useEffect, useMemo, useRef, useState } from "react";
import MobileLayout from "@/components/MobileLayout";
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
  Package
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

function GlassCard(props: { children: React.ReactNode; className?: string }) {
  return <div className={`glass-card p-5 ${props.className ?? ""}`}>{props.children}</div>;
}

export default function ContractorProfile() {
  const { profile } = useAuth();
  const ctx = useMyProfileContext();

  const org = ctx.data?.organization;

  // ----------------------------
  // Upload logo
  // ----------------------------
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

  // ----------------------------
  // Métricas campanhas
  // ----------------------------
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

      // fallback (se necessário)
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
        const closed = notDeleted.filter(
          (c) => c.status === "closed_manual" || c.status === "closed_expired"
        ).length;
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

  // ----------------------------
  // Modal Criar/Editar Negócio
  // ----------------------------
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
    // sempre que abrir modal, pré-preenche (se existir org)
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
        // cria org via RPC (cria membership owner automaticamente)
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
        // update direto (RLS garante owner/admin)
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

  const location = useMemo(() => {
    const city = org?.region_city || profile?.city;
    const state = org?.region_state || profile?.state;
    if (city && state) return `${city}, ${state}`;
    return "—";
  }, [org?.region_city, org?.region_state, profile?.city, profile?.state]);

  const navType = "contractor";

  return (
    <MobileLayout title="Perfil do contratante" showBack navType={navType}>
      <div className="px-6 py-6 space-y-6">
        {/* Header premium */}
        <GlassCard>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                {org?.logo_url ? (
                  <img
                    src={org.logo_url}
                    alt="Logo"
                    className="w-12 h-12 rounded-2xl object-cover border border-primary/20"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-border/50 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}

                <div>
                  <div className="text-lg font-semibold text-foreground">{title}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{location}</span>
                  </div>
                </div>
              </div>

              {(org?.business_category || org?.product_or_brand) && (
                <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                  {org?.business_category ? (
                    <span className="inline-flex items-center gap-1">
                      <Tag className="w-4 h-4" />
                      {org.business_category}
                    </span>
                  ) : null}
                  {org?.business_category && org?.product_or_brand ? <span>•</span> : null}
                  {org?.product_or_brand ? (
                    <span className="inline-flex items-center gap-1">
                      <Package className="w-4 h-4" />
                      {org.product_or_brand}
                    </span>
                  ) : null}
                </div>
              )}

              {org?.website_url && (
                <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  <a className="underline hover:opacity-80" href={org.website_url} target="_blank" rel="noreferrer">
                    {org.website_url}
                  </a>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
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
              Para enviar logo e exibir dados do negócio, crie o perfil do seu negócio acima.
            </div>
          )}
        </GlassCard>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Campanhas"
            value={loadingMetrics ? "…" : metrics.total}
            icon={<Megaphone className="w-4 h-4 text-primary" />}
          />
          <MetricCard
            label="Ativas"
            value={loadingMetrics ? "…" : metrics.active}
            icon={<CircleDot className="w-4 h-4 text-accent" />}
          />
          <MetricCard
            label="Concluídas"
            value={loadingMetrics ? "…" : metrics.completed}
            icon={<CheckCircle2 className="w-4 h-4 text-primary" />}
          />
          <MetricCard
            label="Encerradas"
            value={loadingMetrics ? "…" : metrics.closed}
            icon={<FileText className="w-4 h-4 text-muted-foreground" />}
          />
          <MetricCard label="Rascunhos" value={loadingMetrics ? "…" : metrics.draft} />
          <MetricCard
            label="Excluídas"
            value={loadingMetrics ? "…" : metrics.deleted}
            icon={<Trash2 className="w-4 h-4 text-destructive" />}
          />
        </div>

        {/* Modal Criar/Editar negócio */}
        {orgOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => (orgSaving ? null : setOrgOpen(false))} />
            <div className="relative w-full md:max-w-md rounded-t-3xl md:rounded-3xl border border-border/50 bg-background p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">
                  {isEditingOrg ? "Editar negócio" : "Criar negócio"}
                </div>
                <button className="p-2 rounded-xl hover:bg-white/5" onClick={() => (orgSaving ? null : setOrgOpen(false))}>
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
                    placeholder="Ex: Hamburgueria"
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Produto/Marca</Label>
                  <Input
                    value={orgForm.product_or_brand}
                    onChange={(e) => setOrgForm((s) => ({ ...s, product_or_brand: e.target.value }))}
                    placeholder="Ex: Smash Burger"
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
                  * O perfil do contratante representa seu negócio. Você pode editar depois.
                </div>
              </div>
            </div>
          </div>
        )}

        {ctx.error && (
          <div className="text-xs text-muted-foreground">
            Erro ao carregar contexto premium: {ctx.error}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}