import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Upload,
  Download,
  Trash2,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  Link as LinkIcon,
  ClipboardCheck,
  Send,
  Save,
} from "lucide-react";
import {
  CampaignFileItem,
  CampaignFileKind,
  deleteCampaignFile,
  getCampaignFileSignedUrl,
  listCampaignFiles,
  uploadCampaignFile,
} from "@/services/campaignFiles";
import { supabase } from "@/integrations/supabase/client";

function GlassCard(props: { children: React.ReactNode; className?: string }) {
  return <div className={`glass-card p-5 ${props.className ?? ""}`}>{props.children}</div>;
}

function kindLabel(kind: CampaignFileKind) {
  return kind === "assets" ? "Assets" : "Entregas";
}

function fileIcon(mime?: string | null) {
  if (mime?.startsWith("image/")) return <ImageIcon className="w-4 h-4 text-primary" />;
  return <FileText className="w-4 h-4 text-muted-foreground" />;
}

type DeliverableStatus = "draft" | "submitted" | "approved" | "changes_requested";

type DeliverablesRow = {
  id: string;
  campaign_id: string;
  creator_id: string;
  status: DeliverableStatus;
  checklist: Record<string, boolean>;
  links: string[];
  notes: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

const DEFAULT_CHECKLIST: Array<{ key: string; label: string }> = [
  { key: "posts_done", label: "Realizei todos os posts solicitados" },
  { key: "mentions_done", label: "Fiz todas as marcações (tags) exigidas" },
  { key: "proofs_attached", label: "Anexei prints/arquivos de comprovação" },
  { key: "links_added", label: "Incluí links das publicações" },
];

export default function CampaignFilesTab(props: {
  campaignId: string;
  role: "contractor" | "influencer";
  influencerAccepted: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CampaignFileItem[]>([]);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Deliverables (creator)
  const [deliverablesLoading, setDeliverablesLoading] = useState(false);
  const [deliverablesAvailable, setDeliverablesAvailable] = useState(true);
  const [deliverablesRow, setDeliverablesRow] = useState<DeliverablesRow | null>(null);

  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const it of DEFAULT_CHECKLIST) init[it.key] = false;
    return init;
  });

  const [links, setLinks] = useState<string[]>([""]);
  const [notes, setNotes] = useState("");

  const fileRef = useRef<HTMLInputElement | null>(null);

  const canUploadAssets = props.role === "contractor";
  const canUploadDeliverables = props.role === "influencer" && props.influencerAccepted;

  const visibleKinds = useMemo(() => {
    if (props.role === "contractor") return ["assets", "deliverables"] as CampaignFileKind[];
    return props.influencerAccepted ? (["assets", "deliverables"] as CampaignFileKind[]) : ([] as CampaignFileKind[]);
  }, [props.role, props.influencerAccepted]);

  const grouped = useMemo(() => {
    const map: Record<CampaignFileKind, CampaignFileItem[]> = { assets: [], deliverables: [] };
    for (const it of items) map[it.kind].push(it);
    return map;
  }, [items]);

  const deliverablesFilesCount = grouped.deliverables.length;

  async function refetch() {
    setLoading(true);
    try {
      const all = await listCampaignFiles({ campaignId: props.campaignId });
      setItems(all);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar arquivos.");
    } finally {
      setLoading(false);
    }
  }

  const hydrateDeliverablesFromRow = (row: DeliverablesRow | null) => {
    if (!row) return;

    // checklist
    const base: Record<string, boolean> = {};
    for (const it of DEFAULT_CHECKLIST) base[it.key] = false;

    const merged = { ...base, ...(row.checklist || {}) };
    setChecklist(merged);

    // links
    const rowLinks = Array.isArray(row.links) ? row.links.filter((x) => typeof x === "string") : [];
    setLinks(rowLinks.length ? rowLinks : [""]);

    // notes
    setNotes(row.notes ?? "");
  };

  const fetchDeliverables = async () => {
    if (!(props.role === "influencer" && props.influencerAccepted)) return;

    setDeliverablesLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Usuário não autenticado.");

      const { data, error } = await supabase
        .from("campaign_creator_deliverables")
        .select("*")
        .eq("campaign_id", props.campaignId)
        .eq("creator_id", auth.user.id)
        .maybeSingle();

      if (error) {
        const msg = (error.message || "").toLowerCase();
        const looksMissing =
          msg.includes("does not exist") ||
          msg.includes("could not find the relation") ||
          msg.includes("schema cache") ||
          msg.includes("permission denied");

        if (looksMissing) {
          setDeliverablesAvailable(false);
          setDeliverablesRow(null);
          return;
        }

        throw error;
      }

      setDeliverablesAvailable(true);
      setDeliverablesRow((data as any) ?? null);
      hydrateDeliverablesFromRow((data as any) ?? null);
    } catch (e: any) {
      console.error("FETCH_DELIVERABLES_ERROR", e);
      // sem quebrar UX
      setDeliverablesAvailable(false);
    } finally {
      setDeliverablesLoading(false);
    }
  };

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.campaignId, props.influencerAccepted, props.role]);

  useEffect(() => {
    fetchDeliverables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.campaignId, props.influencerAccepted, props.role]);

  const handlePickUpload = () => {
    if (!canUploadAssets && !canUploadDeliverables) {
      toast.error("Você não tem permissão para enviar arquivos nesta campanha.");
      return;
    }
    fileRef.current?.click();
  };

  const handleUploadFiles = async (files?: FileList | null) => {
    if (!files || files.length === 0) return;

    const kind: CampaignFileKind = props.role === "contractor" ? "assets" : "deliverables";

    if (kind === "deliverables" && !props.influencerAccepted) {
      toast.error("Você precisa ser aceita para enviar entregas.");
      return;
    }

    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Usuário não autenticado.");

      // upload múltiplo
      for (const file of Array.from(files)) {
        await uploadCampaignFile({
          campaignId: props.campaignId,
          kind,
          ownerId: auth.user.id,
          file,
          upsert: false, // múltiplos arquivos: não sobrescreve
        });
      }

      toast.success(kind === "assets" ? "Arquivos enviados para Assets!" : "Entregas enviadas!");
      await refetch();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar arquivo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDownload = async (it: CampaignFileItem) => {
    setDownloadingPath(it.path);
    try {
      const url = await getCampaignFileSignedUrl({ path: it.path, expiresInSeconds: 60 * 10 });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao baixar arquivo.");
    } finally {
      setDownloadingPath(null);
    }
  };

  const handleDelete = async (it: CampaignFileItem) => {
    setDeletingPath(it.path);
    try {
      await deleteCampaignFile({ path: it.path });
      toast.success("Arquivo removido.");
      await refetch();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao remover arquivo.");
    } finally {
      setDeletingPath(null);
    }
  };

  const canDelete = (it: CampaignFileItem) => {
    if (props.role === "contractor") return true;
    return props.role === "influencer" && it.kind === "deliverables";
  };

  const normalizeLinks = (arr: string[]) =>
    arr
      .map((s) => (s || "").trim())
      .filter((s) => s.length > 0)
      .slice(0, 10);

  const saveDeliverables = async (mode: "draft" | "submitted") => {
    if (!(props.role === "influencer" && props.influencerAccepted)) return;

    if (!deliverablesAvailable) {
      toast.error("Módulo de entregas ainda não está disponível.");
      return;
    }

    if (mode === "submitted") {
      // regra mínima de segurança: precisa ter pelo menos 1 arquivo de entrega
      if (deliverablesFilesCount < 1) {
        toast.error("Envie pelo menos 1 arquivo em Entregas antes de enviar para revisão.");
        return;
      }
    }

    setDeliverablesLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Usuário não autenticado.");

      const cleanLinks = normalizeLinks(links);

      const payload: any = {
        campaign_id: props.campaignId,
        creator_id: auth.user.id,
        status: mode,
        checklist: {
          ...checklist,
          // reforço automático coerente:
          proofs_attached: deliverablesFilesCount > 0 ? true : checklist.proofs_attached,
          links_added: cleanLinks.length > 0 ? true : checklist.links_added,
        },
        links: cleanLinks,
        notes: notes.trim() || null,
        submitted_at: mode === "submitted" ? new Date().toISOString() : null,
      };

      const { data, error } = await supabase
        .from("campaign_creator_deliverables")
        .upsert(payload, { onConflict: "campaign_id,creator_id" })
        .select("*")
        .maybeSingle();

      if (error) {
        const msg = (error.message || "").toLowerCase();
        const looksLikeCache =
          msg.includes("schema cache") || msg.includes("does not exist") || msg.includes("permission denied");

        if (looksLikeCache) {
          toast.error(
            "Tabela de entregas ainda não está disponível/permitida (schema cache/RLS). Aplique o SQL e recarregue o schema cache."
          );
          setDeliverablesAvailable(false);
          return;
        }
        throw error;
      }

      setDeliverablesRow((data as any) ?? null);
      hydrateDeliverablesFromRow((data as any) ?? null);

      toast.success(mode === "draft" ? "Rascunho salvo." : "Enviado para revisão!");
    } catch (e: any) {
      console.error("SAVE_DELIVERABLES_ERROR", e);
      toast.error(e?.message || "Erro ao salvar entregas.");
    } finally {
      setDeliverablesLoading(false);
    }
  };

  if (props.role === "influencer" && !props.influencerAccepted) {
    return (
      <GlassCard>
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-foreground">Arquivos da campanha</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Você verá os arquivos e poderá enviar entregas após confirmar participação.
            </div>
          </div>
        </div>
      </GlassCard>
    );
  }

  const headerSubtitle =
    props.role === "contractor"
      ? "Assets (briefing/arte) e entregas (prints/comprovação)."
      : "Baixe os assets e envie suas entregas com comprovações.";

  const uploadLabel = props.role === "contractor" ? "Enviar assets" : "Enviar entregas";

  return (
    <div className="space-y-4">
      <GlassCard className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">Arquivos</div>
          <div className="text-xs text-muted-foreground">{headerSubtitle}</div>
        </div>

        {(canUploadAssets || canUploadDeliverables) && (
          <button
            onClick={handlePickUpload}
            disabled={uploading}
            className="rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition flex items-center gap-2 disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            ) : (
              <Upload className="w-4 h-4 text-primary" />
            )}
            {uploadLabel}
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => handleUploadFiles(e.target.files)}
        />
      </GlassCard>

      {/* Etapa B: checklist e links (só influencer aceito) */}
      {props.role === "influencer" && props.influencerAccepted && (
        <GlassCard className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-primary" />
                Checklist & comprovações
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Preencha e envie para revisão quando tudo estiver pronto. Isso evita conflitos e valida a entrega.
              </div>
            </div>

            {deliverablesRow?.status && (
              <span className="text-[10px] px-2 py-1 rounded-full border border-border/50 bg-card/60 text-muted-foreground capitalize">
                {deliverablesRow.status === "draft"
                  ? "rascunho"
                  : deliverablesRow.status === "submitted"
                    ? "em revisão"
                    : deliverablesRow.status === "approved"
                      ? "aprovado"
                      : "ajustes"}
              </span>
            )}
          </div>

          {!deliverablesAvailable ? (
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              Módulo de checklist/links ainda não está disponível. Por enquanto, envie suas provas em “Entregas”.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {DEFAULT_CHECKLIST.map((it) => (
                  <label
                    key={it.key}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-white/5 p-3"
                  >
                    <div className="text-sm text-foreground/85">{it.label}</div>
                    <input
                      type="checkbox"
                      checked={!!checklist[it.key]}
                      onChange={(e) => setChecklist((s) => ({ ...s, [it.key]: e.target.checked }))}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                ))}
              </div>

              <div className="rounded-2xl border border-border/50 bg-white/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <LinkIcon className="w-4 h-4 text-primary" />
                  Links das publicações
                </div>

                <div className="space-y-2">
                  {links.map((val, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={val}
                        onChange={(e) =>
                          setLinks((arr) => {
                            const copy = [...arr];
                            copy[idx] = e.target.value;
                            return copy;
                          })
                        }
                        placeholder="https://instagram.com/p/..."
                        className="w-full rounded-xl border border-border/50 bg-card/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                      />
                      <button
                        onClick={() =>
                          setLinks((arr) => {
                            const copy = [...arr];
                            copy.splice(idx, 1);
                            return copy.length ? copy : [""];
                          })
                        }
                        className="rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition"
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setLinks((arr) => [...arr, ""])}
                  className="mt-1 rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition"
                >
                  Adicionar link
                </button>
              </div>

              <div className="rounded-2xl border border-border/50 bg-white/5 p-3 space-y-2">
                <div className="text-sm font-semibold text-foreground">Observações</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-border/50 bg-card/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                  placeholder="Ex.: horários de postagem, contexto, observações importantes..."
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => saveDeliverables("draft")}
                  disabled={deliverablesLoading}
                  className="flex-1 py-3 rounded-xl border border-border/50 bg-card/60 text-foreground font-semibold text-sm hover:bg-card/80 transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {deliverablesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar rascunho
                </button>

                <button
                  onClick={() => saveDeliverables("submitted")}
                  disabled={deliverablesLoading}
                  className="flex-1 py-3 rounded-xl border border-accent/30 bg-accent/10 text-accent font-semibold text-sm hover:bg-accent/15 transition disabled:opacity-60 flex items-center justify-center gap-2"
                  title={deliverablesFilesCount < 1 ? "Envie ao menos 1 arquivo em Entregas" : "Enviar para revisão"}
                >
                  {deliverablesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar para revisão
                </button>
              </div>

              <div className="text-xs text-muted-foreground">
                Dica: envie prints e PDFs em “Entregas”. Depois clique em <b className="text-foreground">Enviar para revisão</b>.
              </div>
            </>
          )}
        </GlassCard>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {visibleKinds.map((k) => (
            <GlassCard key={k} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">{kindLabel(k)}</div>
                {k === "deliverables" && (
                  <div className="text-xs text-muted-foreground">
                    {grouped[k].length} arquivo(s)
                  </div>
                )}
              </div>

              {grouped[k].length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {k === "assets"
                    ? "Nenhum arquivo de briefing/arte foi enviado ainda."
                    : "Nenhuma entrega foi enviada ainda."}
                </div>
              ) : (
                <div className="space-y-2">
                  {grouped[k].map((it) => (
                    <div
                      key={it.path}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-white/5 p-3"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {fileIcon(it.mimetype)}
                        <div className="min-w-0">
                          <div className="text-sm text-foreground truncate">{it.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {it.updated_at ? new Date(it.updated_at).toLocaleString("pt-BR") : "—"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDownload(it)}
                          disabled={downloadingPath === it.path}
                          className="rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition disabled:opacity-60"
                          title="Baixar"
                        >
                          {downloadingPath === it.path ? (
                            <Loader2 className="w-4 h-4 text-primary animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 text-primary" />
                          )}
                        </button>

                        {canDelete(it) && (
                          <button
                            onClick={() => handleDelete(it)}
                            disabled={deletingPath === it.path}
                            className="rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition disabled:opacity-60"
                            title="Excluir"
                          >
                            {deletingPath === it.path ? (
                              <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4 text-destructive" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}