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
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";

/* =========================
   UI helpers (padrão influencer)
========================= */

function GlassCard(props: { children: React.ReactNode; className?: string }) {
  return <div className={`glass-card p-5 ${props.className ?? ""}`}>{props.children}</div>;
}

function safeUrl(url?: string | null) {
  const raw = (url || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function initials(name?: string | null) {
  const n = (name || "").trim();
  if (!n) return "N";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function IconButton(props: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={`inline-flex items-center gap-2 rounded-xl border border-border/50 bg-white/5 px-3 py-2 text-sm text-foreground transition
      hover:bg-white/10 hover:shadow-sm active:scale-[0.99]
      disabled:opacity-60 disabled:hover:bg-white/5 ${props.className ?? ""}`}
    >
      <span className="text-primary">{props.icon}</span>
      <span className="truncate">{props.label}</span>
    </button>
  );
}

/** ✅ Chip micro com label + valor empilhado (compacto e premium) */
function MicroChip(props: { icon: React.ReactNode; label: string; value: string; title?: string }) {
  return (
    <div
      title={props.title}
      className="h-12 min-w-0 flex items-center gap-2 rounded-2xl border border-border/50 bg-white/5 px-3
      text-[11px] text-foreground/90 shadow-sm"
    >
      <span className="text-primary shrink-0">{props.icon}</span>
      <div className="min-w-0 leading-tight">
        <div className="text-[10px] text-muted-foreground whitespace-nowrap">{props.label}:</div>
        <div className="text-xs font-semibold truncate whitespace-nowrap">{props.value}</div>
      </div>
    </div>
  );
}

function MetricCard(props: { label: string; value: React.ReactNode; icon?: React.ReactNode; hint?: string }) {
  return (
    <div
      className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur shadow-sm transition
      hover:bg-white/10 hover:shadow-md hover:-translate-y-[1px] active:scale-[0.99]"
    >
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

/* =========================
   Page
========================= */

export default function ContractorProfile() {
  const navigate = useNavigate();

  // ⚠️ Mantém compatível: se seu useAuth não tiver userRole/approvalStatus, não quebra
  const auth = useAuth() as any;
  const profile = auth?.profile;
  const userRole = auth?.userRole;
  const approvalStatus = auth?.approvalStatus;

  const ctx = useMyProfileContext();
  const org = (ctx.data as any)?.organization;

  const isVerifiedContractor = userRole === "contractor" && approvalStatus === "approved";

  /* -------------------------
     Upload logo
  ------------------------- */
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

  /* -------------------------
     Métricas campanhas
  ------------------------- */
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

      const m = (ctx.data as any)?.organization_metrics;
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
  }, [(ctx.data as any)?.organization_metrics]);

  /* -------------------------
     Modal Criar/Editar Negócio
  ------------------------- */
  const [orgOpen, setOrgOpen] = useState(false);
  const [orgSaving, setOrgSaving] = useState(false);

  const [orgForm, setOrgForm] = useState({
    name: "",
    region_city: "",
    region_state: "",
    business_category: "",
    product_or_brand: "",
    website_url: "",
    bio: "",
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
      bio: org?.bio ?? "",
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
          bio: orgForm.bio.trim() || undefined,
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
            bio: orgForm.bio.trim() || null,
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

  /* -------------------------
     Dados exibidos
  ------------------------- */
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

  const headerBio = (org?.bio || "").trim();
  const [bioOpen, setBioOpen] = useState(false);
  const showBioMore = useMemo(() => headerBio.length > 140, [headerBio]);

  const category = (org?.business_category || "—").trim() || "—";
  const productOrBrand = (org?.product_or_brand || "").trim();

  const navType = "contractor";

  return (
    <MobileLayout title="Meu negócio" showBack navType={navType}>
      <div className="px-6 py-6 space-y-6">
        {/* =========================
            HEADER PREMIUM (igual influencer)
        ========================= */}
        <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-white/5 shadow-sm">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5" />
            <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:16px_16px]" />
          </div>

          <div className="relative p-5">
            <div className="flex items-start gap-4">
              {/* Logo */}
              <div className="relative shrink-0">
                <div className="absolute -inset-2 rounded-3xl bg-primary/10 blur-lg opacity-60" />
                <div className="relative w-20 h-20 rounded-3xl overflow-hidden border border-primary/20 bg-white/5 flex items-center justify-center">
                  {org?.logo_url ? (
                    <img
                      src={org.logo_url}
                      alt="Logo"
                      className="w-full h-full object-cover block"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-primary font-bold">{initials(title)}</span>
                  )}
                </div>

                <div className="pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-white/10" />

                <button
                  type="button"
                  onClick={handlePickLogo}
                  disabled={logoUploading || !org?.id}
                  className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-primary flex items-center justify-center disabled:opacity-60 shadow-md"
                  title="Trocar logo"
                >
                  {logoUploading ? (
                    <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
                  ) : (
                    <ImagePlus className="w-4 h-4 text-primary-foreground" />
                  )}
                </button>

                <input
                  ref={logoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleLogoFile(e.target.files?.[0])}
                />
              </div>

              {/* Infos */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-xl font-semibold text-foreground leading-tight break-words">{title}</h1>
                  {isVerifiedContractor ? (
                    <span className="shrink-0">
                      <VerifiedBadge size="sm" />
                    </span>
                  ) : null}
                </div>

                {/* Bio limpa */}
                <div className="mt-2 text-sm text-foreground/90 leading-relaxed">
                  {headerBio ? (
                    <>
                      <span className="line-clamp-3">{headerBio}</span>
                      {showBioMore ? (
                        <button
                          type="button"
                          onClick={() => setBioOpen(true)}
                          className="mt-1 text-xs text-primary hover:opacity-90 transition"
                        >
                          Ver mais
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Adicione uma descrição do seu negócio.</span>
                  )}
                </div>

                {/* Mini tags (opcional, bem discreto) */}
                {(category !== "—" || productOrBrand) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {category !== "—" ? (
                      <span className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-full border border-border/50 bg-white/5 text-foreground/90">
                        <Tag className="w-4 h-4 text-primary" />
                        <span className="truncate max-w-[140px]">{category}</span>
                      </span>
                    ) : null}

                    {productOrBrand ? (
                      <span className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-full border border-border/50 bg-white/5 text-foreground/90">
                        <Package className="w-4 h-4 text-primary" />
                        <span className="truncate max-w-[160px]">{productOrBrand}</span>
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            {/* ações */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <IconButton
                icon={<Pencil className="w-4 h-4" />}
                label={org ? "Editar negócio" : "Criar negócio"}
                onClick={() => setOrgOpen(true)}
                className="w-full justify-center"
              />

              <IconButton
                icon={<Globe className="w-4 h-4" />}
                label={website ? "Site" : "Site"}
                onClick={openWebsite}
                disabled={!website}
                className="w-full justify-center"
              />
            </div>

            {/* ação secundária: ver perfil público */}
            {profile?.id ? (
              <button
                type="button"
                onClick={() => navigate(`/u/${profile.id}`)}
                className="mt-3 w-full rounded-xl border border-border/50 bg-white/5 px-3 py-2 text-sm text-foreground transition hover:bg-white/10 flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4 text-primary" />
                Ver perfil público
              </button>
            ) : null}

            {!org && (
              <div className="mt-3 text-xs text-muted-foreground">
                Para exibir o negócio completo e permitir envio de logo, crie o perfil do seu negócio.
              </div>
            )}
          </div>
        </div>

        {/* MODAL Bio */}
        {bioOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
            <div className="absolute inset-0 bg-black/60" onMouseDown={() => setBioOpen(false)} />
            <div
              className="relative w-full md:max-w-lg rounded-t-3xl md:rounded-3xl border border-border/50 bg-background p-5"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">Sobre</div>
                <button className="p-2 rounded-xl hover:bg-white/5" onClick={() => setBioOpen(false)} type="button">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 text-sm text-foreground leading-relaxed whitespace-pre-line">{headerBio}</div>
            </div>
          </div>
        )}

        {/* 3 CHIPS (substitui quick cards) */}
        <div className="grid grid-cols-3 gap-2">
          <MicroChip icon={<MapPin className="w-4 h-4" />} label="Localização" value={locationLabel} title="Abrir no Maps" />
          <MicroChip icon={<Tag className="w-4 h-4" />} label="Categoria" value={category} title={category} />
          <MicroChip
            icon={<Megaphone className="w-4 h-4" />}
            label="Ativações"
            value={loadingMetrics ? "—" : String(metrics.total)}
            title="Total de campanhas (por enquanto)"
          />
        </div>

        {/* AÇÃO rápida: Maps + Site (discreto, mas útil) */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={openMaps}
            className="rounded-2xl border border-border/50 bg-white/5 hover:bg-white/10 px-3 py-3 text-sm transition flex items-center justify-center gap-2"
          >
            <MapPin className="w-4 h-4 text-primary" />
            Abrir no Maps
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </button>

          <button
            type="button"
            onClick={openWebsite}
            disabled={!website}
            className={`rounded-2xl border px-3 py-3 text-sm transition flex items-center justify-center gap-2 ${
              website ? "border-border/50 bg-white/5 hover:bg-white/10" : "border-border/30 bg-white/5 opacity-60"
            }`}
          >
            <Globe className="w-4 h-4 text-primary" />
            Abrir Site
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* =========================
            ATIVAÇÕES E CAMPANHAS (repaginado)
        ========================= */}
        <GlassCard className="space-y-3">
          <div className="text-sm font-semibold text-foreground text-center">Ativações e campanhas</div>

          {loadingMetrics ? (
            <div className="flex justify-center py-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Campanhas" value={metrics.total} icon={<Megaphone className="w-4 h-4 text-primary" />} />
              <MetricCard label="Ativas" value={metrics.active} icon={<CircleDot className="w-4 h-4 text-primary" />} />
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
            <div className="absolute inset-0 bg-black/60" onMouseDown={() => (orgSaving ? null : setOrgOpen(false))} />
            <div
              className="relative w-full md:max-w-md rounded-t-3xl md:rounded-3xl border border-border/50 bg-background p-5"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">{isEditingOrg ? "Editar negócio" : "Criar negócio"}</div>
                <button
                  className="p-2 rounded-xl hover:bg-white/5"
                  onClick={() => (orgSaving ? null : setOrgOpen(false))}
                  title="Fechar"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4 max-h-[70vh] overflow-auto pr-1">
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

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Descrição (bio)</Label>
                  <Input
                    value={orgForm.bio}
                    onChange={(e) => setOrgForm((s) => ({ ...s, bio: e.target.value }))}
                    placeholder="Uma descrição curta do seu negócio"
                    className="text-sm"
                  />
                  <div className="text-[11px] text-muted-foreground">
                    O header mostra no máximo 3 linhas (use uma descrição curta).
                  </div>
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
                  Este perfil representa seu negócio para influenciadores e para a Orbty.
                </div>
              </div>
            </div>
          </div>
        )}

        {ctx.error && <div className="text-xs text-muted-foreground">Erro ao carregar contexto premium: {String(ctx.error)}</div>}
      </div>
    </MobileLayout>
  );
}