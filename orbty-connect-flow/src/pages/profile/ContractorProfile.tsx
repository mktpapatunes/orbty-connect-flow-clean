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
  ImagePlus,
  Building2,
  Pencil,
  Save,
  X,
  Globe,
  Package,
  Instagram,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* =========================
   UI helpers
========================= */

function safeUrl(url?: string | null) {
  const raw = (url || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
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

function MicroChip(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
  title?: string;
  onClick?: () => void;
  clickable?: boolean;
}) {
  const clickable = !!props.onClick || !!props.clickable;

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={!clickable}
      title={props.title}
      className={`h-12 min-w-0 flex items-center gap-2 rounded-2xl border border-border/50 bg-white/5 px-3
      text-[11px] text-foreground/90 shadow-sm text-left
      ${clickable ? "hover:bg-white/10 hover:shadow-sm active:scale-[0.99]" : "opacity-100"}
      disabled:opacity-100 disabled:cursor-default`}
    >
      <span className="shrink-0 text-primary">{props.icon}</span>
      <div className="min-w-0 leading-tight">
        <div className="text-[10px] text-muted-foreground whitespace-nowrap">{props.label}:</div>
        <div className="text-xs font-semibold truncate whitespace-nowrap">{props.value}</div>
      </div>
      {clickable ? <span className="ml-auto text-[10px] text-muted-foreground">↗</span> : null}
    </button>
  );
}

function MetricCard(props: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border border-border/50 bg-white/5 p-4 backdrop-blur shadow-sm transition
      hover:bg-white/10 hover:shadow-md hover:-translate-y-[1px] active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{props.label}</div>
        </div>
        {props.icon}
      </div>
      <div className="mt-2 text-xl font-semibold text-foreground">{props.value}</div>
    </div>
  );
}

/** ✅ Selo verificado amarelo (apenas contratante)
 * Mantém o componente original (influencer não muda).
 * A forma mais segura sem mexer no VerifiedBadge é aplicar filter no wrapper.
 */
function ContractorVerifiedBadge() {
  return (
    <span
      className="inline-flex items-center"
      // Ajuste fino para transformar o azul em amarelo (sem quebrar o badge)
      style={{
        filter: "hue-rotate(205deg) saturate(180%) brightness(120%)",
      }}
      title="Conta aprovada"
    >
      <VerifiedBadge size="sm" />
    </span>
  );
}

/* =========================
   Avaliações (negócio)
========================= */

function SkeletonLine({ w = "100%", h = 12 }: { w?: string; h?: number }) {
  return <div className="animate-pulse rounded-xl bg-white/10" style={{ width: w, height: h }} />;
}

function StarRating(props: { value: number; max?: number; className?: string }) {
  const max = props.max ?? 5;
  const v = Math.max(0, Math.min(max, Number(props.value ?? 0)));
  const full = Math.round(v);

  return (
    <div className={`flex items-center justify-center gap-1 ${props.className ?? ""}`} aria-label={`Avaliação: ${full} de ${max}`}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < full;
        return (
          <span
            key={i}
            className={`text-[26px] leading-none select-none ${filled ? "text-yellow-400" : "text-white/20"}`}
            aria-hidden="true"
          >
            ★
          </span>
        );
      })}
    </div>
  );
}

function RatingsCard(props: { rating: number; count?: number | null; loading?: boolean }) {
  if (props.loading) {
    return (
      <div className="glass-card p-5 shadow-sm transition hover:shadow-md hover:bg-white/[0.06]">
        <div className="text-sm font-semibold text-foreground text-center">Avaliações</div>
        <div className="mt-4 flex justify-center">
          <SkeletonLine w="180px" h={22} />
        </div>
        <div className="mt-3 flex justify-center">
          <SkeletonLine w="140px" h={10} />
        </div>
      </div>
    );
  }

  const safeRating = Math.max(0, Math.min(5, Number(props.rating ?? 0)));
  const count = props.count ?? null;

  return (
    <div className="glass-card p-5 shadow-sm transition hover:shadow-md hover:bg-white/[0.06]">
      <div className="text-sm font-semibold text-foreground text-center">Avaliações</div>

      <div className="mt-3">
        <StarRating value={safeRating} />
      </div>

      <div className="mt-2 text-center text-xs text-muted-foreground">
        {count && count > 0 ? `${safeRating.toFixed(1).replace(".", ",")} · ${count} avaliações` : "Sem avaliações ainda"}
      </div>
    </div>
  );
}

/* =========================
   Catálogo: Categorias + Produtos
========================= */

const BUSINESS_CATEGORIES = [
  "Restaurante",
  "Cafeteria / Doceria",
  "Moda / Loja",
  "Beleza / Estética",
  "Academia / Fitness",
  "Clínica / Saúde",
  "Hotelaria / Turismo",
  "Eventos",
  "Imobiliária",
  "Auto / Serviços",
  "Mercado / Varejo",
  "Tecnologia",
  "Educação",
  "Música",
  "Arte",
] as const;

const PRODUCTS_BY_CATEGORY: Record<string, string[]> = {
  Restaurante: ["Cardápio", "Lançamento", "Delivery", "Promoção", "Hambúrguer"],
  "Cafeteria / Doceria": ["Menu", "Novidade", "Delivery", "Promoção"],
  "Moda / Loja": ["Coleção", "Lançamento", "Cupom", "Liquidação"],
  "Beleza / Estética": ["Procedimento", "Pacote", "Promoção", "Lançamento"],
  "Academia / Fitness": ["Plano", "Desafio", "Aula", "Promoção"],
  "Clínica / Saúde": ["Serviço", "Consulta", "Programa", "Especialidade"],
  "Hotelaria / Turismo": ["Hospedagem", "Pacote", "Experiência", "Promoção"],
  Eventos: ["Evento", "Ingresso", "Lote", "Divulgação"],
  Imobiliária: ["Imóvel", "Lançamento", "Open house", "Captação"],
  "Auto / Serviços": ["Serviço", "Revisão", "Promoção", "Campanha"],
  "Mercado / Varejo": ["Produto", "Oferta", "Campanha", "Lançamento"],
  Tecnologia: ["Produto", "Serviço", "Lançamento", "Oferta"],
  Educação: ["Curso", "Turma", "Matrícula", "Evento"],
  Música: ["Show", "Lançamento", "Divulgação", "Evento"],
  Arte: ["Exposição", "Coleção", "Divulgação", "Evento"],
};

/* =========================
   Page
========================= */

export default function ContractorProfile() {
  // ⚠️ Mantém compatível
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
     Avaliações (negócio) - leitura segura
     View esperada: organization_rating_summary (organization_id, avg_rating, rating_count)
     Se não existir: não quebra e mostra vazio.
  ------------------------- */
  const [ratingAvg, setRatingAvg] = useState<number>(0);
  const [ratingCount, setRatingCount] = useState<number | null>(null);
  const [loadingRatings, setLoadingRatings] = useState<boolean>(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!org?.id) {
        setRatingAvg(0);
        setRatingCount(null);
        setLoadingRatings(false);
        return;
      }

      setLoadingRatings(true);
      try {
        const { data, error } = await supabase
          .from("organization_rating_summary")
          .select("avg_rating, rating_count")
          .eq("organization_id", org.id)
          .maybeSingle();

        if (!alive) return;

        if (error) {
          console.warn("organization_rating_summary:", error);
          setRatingAvg(0);
          setRatingCount(null);
          setLoadingRatings(false);
          return;
        }

        if (!data) {
          setRatingAvg(0);
          setRatingCount(null);
          setLoadingRatings(false);
          return;
        }

        const avg = Number((data as any).avg_rating ?? 0);
        const cnt = Number((data as any).rating_count ?? 0);

        setRatingAvg(Number.isFinite(avg) ? avg : 0);
        setRatingCount(Number.isFinite(cnt) ? cnt : null);
        setLoadingRatings(false);
      } catch (e) {
        if (!alive) return;
        console.warn(e);
        setRatingAvg(0);
        setRatingCount(null);
        setLoadingRatings(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [org?.id]);

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
    instagram: "",
    bio: "",
    address_street: "",
    address_number: "",
    address_complement: "",
    address_zip: "",
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
      instagram: org?.instagram ?? "",
      bio: org?.bio ?? "",
      address_street: org?.address_street ?? "",
      address_number: org?.address_number ?? "",
      address_complement: org?.address_complement ?? "",
      address_zip: org?.address_zip ?? "",
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
          instagram: orgForm.instagram.trim() || undefined,
          bio: orgForm.bio.trim() || undefined,
          address_street: orgForm.address_street.trim() || undefined,
          address_number: orgForm.address_number.trim() || undefined,
          address_complement: orgForm.address_complement.trim() || undefined,
          address_zip: orgForm.address_zip.trim() || undefined,
        } as any);

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
            instagram: orgForm.instagram.trim() || null,
            bio: orgForm.bio.trim() || null,
            address_street: orgForm.address_street.trim() || null,
            address_number: orgForm.address_number.trim() || null,
            address_complement: orgForm.address_complement.trim() || null,
            address_zip: orgForm.address_zip.trim() || null,
          } as any)
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

  const igHandle = (org?.instagram || "").trim();
  const igRaw = buildInstagramLinks(igHandle)?.raw ?? null;

  const openMaps = () => {
    const parts = [
      org?.address_street,
      org?.address_number,
      org?.address_complement,
      org?.address_zip,
      org?.region_city || profile?.city,
      org?.region_state || profile?.state,
    ]
      .map((x: any) => (x || "").toString().trim())
      .filter(Boolean);

    const q = encodeURIComponent(parts.length ? parts.join(", ") : locationLabel || "");
    if (!q) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener,noreferrer");
  };

  const headerBio = (org?.bio || "").trim();
  const [bioOpen, setBioOpen] = useState(false);
  const showBioMore = useMemo(() => headerBio.length > 140, [headerBio]);

  const category = (org?.business_category || "—").trim() || "—";
  const product = (org?.product_or_brand || "—").trim() || "—";

  const productsForSelectedCategory = useMemo(() => {
    return PRODUCTS_BY_CATEGORY[orgForm.business_category] || [];
  }, [orgForm.business_category]);

  return (
    <MobileLayout title="Meu negócio" showBack navType="contractor">
      <div className="px-6 py-6 space-y-6">
        {/* HEADER PREMIUM */}
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
                    <img src={org.logo_url} alt="Logo" className="w-full h-full object-cover block" referrerPolicy="no-referrer" />
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

                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoFile(e.target.files?.[0])} />
              </div>

              {/* Infos */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-xl font-semibold text-foreground leading-tight break-words">{title}</h1>
                  {isVerifiedContractor ? (
                    <span className="shrink-0">
                      <ContractorVerifiedBadge />
                    </span>
                  ) : null}
                </div>

                <div className="mt-2 text-sm text-foreground/90 leading-relaxed">
                  {headerBio ? (
                    <>
                      <span className="line-clamp-3">{headerBio}</span>
                      {showBioMore ? (
                        <button type="button" onClick={() => setBioOpen(true)} className="mt-1 text-xs text-primary hover:opacity-90 transition">
                          Ver mais
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Adicione uma descrição do seu negócio.</span>
                  )}
                </div>
              </div>
            </div>

            {/* ações (editar + instagram) */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <IconButton
                icon={<Pencil className="w-4 h-4" />}
                label={org ? "Editar negócio" : "Criar negócio"}
                onClick={() => setOrgOpen(true)}
                className="w-full justify-center"
              />

              <IconButton
                icon={<Instagram className="w-4 h-4" />}
                label={igRaw ? `@${igRaw}` : "Instagram"}
                onClick={() => openInstagram(igHandle)}
                disabled={!igRaw}
                className="w-full justify-center"
              />
            </div>

            {/* botão full: Site */}
            <button
              type="button"
              onClick={openWebsite}
              disabled={!website}
              className={`mt-3 w-full rounded-xl border px-3 py-2 text-sm transition flex items-center justify-center gap-2 ${
                website ? "border-border/50 bg-white/5 hover:bg-white/10" : "border-border/30 bg-white/5 opacity-60"
              }`}
              title={website ? "Abrir site em nova aba" : "Informe o site no Editar negócio"}
            >
              <Globe className="w-4 h-4 text-primary" />
              Site
            </button>

            {!org && (
              <div className="mt-3 text-xs text-muted-foreground">Para exibir o negócio completo e permitir envio de logo, crie o perfil do seu negócio.</div>
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

        {/* 3 CHIPS */}
        <div className="grid grid-cols-3 gap-2">
          <MicroChip
            icon={<MapPin className="w-4 h-4" />}
            label="Localização"
            value={locationLabel}
            title="Abrir no Google Maps"
            onClick={openMaps}
            clickable
          />

          <MicroChip icon={<Building2 className="w-4 h-4" />} label="Categoria" value={category} title={category} />

          <MicroChip icon={<Package className="w-4 h-4" />} label="Produto" value={product} title={product} />
        </div>

        {/* ATIVAÇÕES E CAMPANHAS */}
        <div className="glass-card p-5 shadow-sm transition hover:shadow-md hover:bg-white/[0.06] space-y-3">
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
            </div>
          )}
        </div>

        {/* ✅ AVALIAÇÕES (voltou) */}
        <RatingsCard rating={ratingAvg} count={ratingCount} loading={loadingRatings} />

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
                <button className="p-2 rounded-xl hover:bg-white/5" onClick={() => (orgSaving ? null : setOrgOpen(false))} title="Fechar" type="button">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4 max-h-[70vh] overflow-auto pr-1">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nome do negócio *</Label>
                  <Input value={orgForm.name} onChange={(e) => setOrgForm((s) => ({ ...s, name: e.target.value }))} className="text-sm" />
                </div>

                {/* BIO abaixo do nome */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Descrição (bio)</Label>
                  <Input
                    value={orgForm.bio}
                    onChange={(e) => setOrgForm((s) => ({ ...s, bio: e.target.value }))}
                    placeholder="Uma descrição curta do seu negócio"
                    className="text-sm"
                  />
                  <div className="text-[11px] text-muted-foreground">O header mostra no máximo 3 linhas (use uma descrição curta).</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Cidade</Label>
                    <Input value={orgForm.region_city} onChange={(e) => setOrgForm((s) => ({ ...s, region_city: e.target.value }))} className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Estado</Label>
                    <Input value={orgForm.region_state} onChange={(e) => setOrgForm((s) => ({ ...s, region_state: e.target.value }))} className="text-sm" />
                  </div>
                </div>

                {/* Endereço (Maps) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Rua</Label>
                    <Input value={orgForm.address_street} onChange={(e) => setOrgForm((s) => ({ ...s, address_street: e.target.value }))} className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Número</Label>
                    <Input value={orgForm.address_number} onChange={(e) => setOrgForm((s) => ({ ...s, address_number: e.target.value }))} className="text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Complemento</Label>
                    <Input value={orgForm.address_complement} onChange={(e) => setOrgForm((s) => ({ ...s, address_complement: e.target.value }))} className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">CEP</Label>
                    <Input
                      value={orgForm.address_zip}
                      onChange={(e) => setOrgForm((s) => ({ ...s, address_zip: e.target.value }))}
                      className="text-sm"
                      inputMode="numeric"
                    />
                  </div>
                </div>

                {/* Categoria: SELECT (sem digitar) */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Categoria</Label>
                  <select
                    value={orgForm.business_category}
                    onChange={(e) => {
                      const v = e.target.value;
                      const products = PRODUCTS_BY_CATEGORY[v] || [];
                      setOrgForm((s) => ({
                        ...s,
                        business_category: v,
                        product_or_brand: products.includes(s.product_or_brand) ? s.product_or_brand : "",
                      }));
                    }}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Selecione</option>
                    {BUSINESS_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Produto com sugestões por categoria */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Produto</Label>
                  <Input
                    value={orgForm.product_or_brand}
                    onChange={(e) => setOrgForm((s) => ({ ...s, product_or_brand: e.target.value }))}
                    placeholder={productsForSelectedCategory.length ? "Selecione ou digite" : "Selecione a categoria primeiro"}
                    className="text-sm"
                    list="business-product-list"
                    disabled={!orgForm.business_category}
                  />
                  <datalist id="business-product-list">
                    {productsForSelectedCategory.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Instagram</Label>
                  <Input value={orgForm.instagram} onChange={(e) => setOrgForm((s) => ({ ...s, instagram: e.target.value }))} placeholder="@seunegocio" className="text-sm" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Site</Label>
                  <Input value={orgForm.website_url} onChange={(e) => setOrgForm((s) => ({ ...s, website_url: e.target.value }))} placeholder="https://..." className="text-sm" />
                </div>

                <button
                  onClick={handleSaveOrg}
                  disabled={orgSaving}
                  className="w-full py-3 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-sm glow-blue flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {orgSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {orgSaving ? "Salvando..." : "Salvar"}
                </button>

                <div className="text-xs text-muted-foreground">Este perfil representa seu negócio para influenciadores e para a Orbty.</div>
              </div>
            </div>
          </div>
        )}

        {ctx.error && <div className="text-xs text-muted-foreground">Erro ao carregar contexto premium: {String(ctx.error)}</div>}
      </div>
    </MobileLayout>
  );
}