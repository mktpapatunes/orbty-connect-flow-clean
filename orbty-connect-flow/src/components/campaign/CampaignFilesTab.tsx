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
  CheckSquare,
  Square,
  Link as LinkIcon,
  Save,
  Send,
  Info,
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

const deliverableStatusUi = (s?: DeliverableStatus | null) => {
  if (s === "submitted") return { text: "Em revisão", cls: "border-primary/30 bg-primary/10 text-primary" };
  if (s === "approved") return { text: "Aprovado", cls: "border-accent/30 bg-accent/10 text-accent" };
  if (s === "changes_requested") return { text: "Ajustes solicitados", cls: "border-warning/30 bg-warning/10 text-warning" };
  return { text: "Rascunho", cls: "border-border/50 bg-card/60 text-muted-foreground" };
};

type ChecklistItem = { key: string; label: string; required?: boolean };

function buildChecklistFromRequirements(req: any): ChecklistItem[] {
  // Derivado do que existe em requirements (sem inventar regras).
  const items: ChecklistItem[] = [];

  const posts = typeof req?.posts === "number" ? req.posts : req?.posts ? Number(req.posts) : null;
  const format = typeof req?.format === "string" ? req.format : null;
  const mentions = Array.isArray(req?.mentions) ? req.mentions.filter((x: any) => typeof x === "string" && x.trim()) : [];
  const hashtags = Array.isArray(req?.hashtags) ? req.hashtags.filter((x: any) => typeof x === "string" && x.trim()) : [];
  const caption = req?.caption ?? null;
  const collab = typeof req?.collab === "boolean" ? req.collab : null;

  if (posts && posts > 0) items.push({ key: "posts_done", label: `Realizei os posts combinados (${posts})`, required: true });
  if (format) items.push({ key: "format_done", label: `Entreguei no formato combinado (${String(format)})`, required: true });

  if (mentions.length > 0) items.push({ key: "mentions_done", label: "Fiz as marcações (menções) solicitadas", required: true });
  if (hashtags.length > 0) items.push({ key: "hashtags_done", label: "Usei as hashtags solicitadas", required: true });
  if (caption) items.push({ key: "caption_done", label: "Usei a legenda solicitada", required: true });

  if (collab === true) items.push({ key: "collab_done", label: "Publicação em collab realizada", required: true });

  // Comprovações — sempre fazem sentido no fluxo de auditoria
  items.push({ key: "proof_files", label: "Anexei prints/arquivos de comprovação", required: true });
  items.push({ key: "proof_links", label: "Adicionei link(s) da(s) publicação(ões)", required: true });

  return items;
}

export default function CampaignFilesTab(props: {
  campaignId: string;
  role: "contractor" | "influencer";
  influencerAccepted: boolean;
  /** Quando true: desabilita envio e exclusão (ideal p/ contractor no detalhe). */
  readOnly?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CampaignFileItem[]>([]);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Deliverables (creator) — checklist/links/notes
  const [deliverableLoading, setDeliverableLoading] = useState(false);
  const [deliverableSaving, setDeliverableSaving] = useState(false);
  const [deliverableSubmitting, setDeliverableSubmitting] = useState(false);

  const [deliverableStatus, setDeliverableStatus] = useState<DeliverableStatus>("draft");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [links, setLinks] = useState<string[]>([""]);
  const [notes, setNotes] = useState<string>("");

  const [checklistTemplate, setChecklistTemplate] = useState<ChecklistItem[]>([]);

  const fileRef = useRef<HTMLInputElement | null>(null);

  const canUploadAssets = props.role === "contractor" && !props.readOnly;
  const canUploadDeliverables = props.role === "influencer" && props.influencerAccepted && !props.readOnly;

  const visibleKinds = useMemo(() => {
    if (props.role === "contractor") return ["assets", "deliverables"] as CampaignFileKind[];
    return props.influencerAccepted ? (["assets", "deliverables"] as CampaignFileKind[]) : ([] as CampaignFileKind[]);
  }, [props.role, props.influencerAccepted]);

  const grouped = useMemo(() => {
    const map: Record<CampaignFileKind, CampaignFileItem[]> = { assets: [], deliverables: [] };
    for (const it of items) map[it.kind].push(it);
    return map;
  }, [items]);

  async function refetchFiles() {
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

  async function fetchDeliverablesEditor() {
    if (props.role !== "influencer") return;
    if (!props.influencerAccepted) return;

    setDeliverableLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Usuário não autenticado.");

      // 1) requirements -> gerar checklist template
      const { data: cRow, error: cErr } = await supabase
        .from("campaigns")
        .select("requirements")
        .eq("id", props.campaignId)
        .maybeSingle();

      if (cErr) console.error("FETCH_CAMPAIGN_REQUIREMENTS_ERROR", cErr);

      const req = (cRow as any)?.requirements ?? null;
      const tpl = buildChecklistFromRequirements(req);
      setChecklistTemplate(tpl);

      // 2) carregar row existente (se houver)
      const { data: dRow, error: dErr } = await supabase
        .from("campaign_creator_deliverables")
        .select("status, checklist, links, notes, submitted_at, approved_at, updated_at")
        .eq("campaign_id", props.campaignId)
        .eq("creator_id", auth.user.id)
        .maybeSingle();

      if (dErr) {
        console.error("FETCH_CREATOR_DELIVERABLES_ERROR", dErr);
        // não bloqueia edição
      }

      if (dRow) {
        const s = (dRow as any)?.status as DeliverableStatus | null;
        setDeliverableStatus((s || "draft") as DeliverableStatus);

        const ck = (dRow as any)?.checklist;
        setChecklist(ck && typeof ck === "object" ? ck : {});

        const l = (dRow as any)?.links;
        if (Array.isArray(l)) setLinks(l.length ? l.map((x) => String(x ?? "")) : [""]);
        else if (l && typeof l === "object") setLinks(Object.values(l).map((x) => String(x ?? "")).filter(Boolean).concat([""]));
        else if (typeof l === "string") setLinks([l, ""]);
        else setLinks([""]);

        setNotes(String((dRow as any)?.notes ?? ""));
      } else {
        // inicializa checklist com base no template
        const init: Record<string, boolean> = {};
        for (const it of tpl) init[it.key] = false;
        setChecklist(init);
        setLinks([""]);
        setNotes("");
        setDeliverableStatus("draft");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar entregas.");
    } finally {
      setDeliverableLoading(false);
    }
  }

  useEffect(() => {
    refetchFiles();
    fetchDeliverablesEditor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.campaignId, props.influencerAccepted, props.role]);

  const handlePickUpload = () => {
    if (!canUploadAssets && !canUploadDeliverables) {
      toast.error("Você não tem permissão para enviar arquivos nesta campanha.");
      return;
    }
    fileRef.current?.click();
  };

  const handleUploadFile = async (file?: File | null) => {
    if (!file) return;

    const kind: CampaignFileKind = props.role === "contractor" ? "assets" : "deliverables";

    if (kind === "deliverables" && !props.influencerAccepted) {
      toast.error("Você precisa confirmar participação para enviar entregas.");
      return;
    }

    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Usuário não autenticado.");

      await uploadCampaignFile({
        campaignId: props.campaignId,
        kind,
        ownerId: auth.user.id,
        file,
        upsert: true,
      });

      toast.success(kind === "assets" ? "Arquivo enviado para Assets!" : "Arquivo de entrega enviado!");
      await refetchFiles();
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
      await refetchFiles();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao remover arquivo.");
    } finally {
      setDeletingPath(null);
    }
  };

  const canDelete = (it: CampaignFileItem) => {
    if (props.readOnly) return false;
    if (props.role === "contractor") return true;
    return props.role === "influencer" && it.kind === "deliverables";
  };

  const addLinkRow = () => setLinks((prev) => [...prev, ""]);
  const updateLink = (idx: number, value: string) => {
    setLinks((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };
  const removeLink = (idx: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveDeliverables = async (nextStatus: DeliverableStatus) => {
    if (props.role !== "influencer") return;
    if (!props.influencerAccepted) return;

    setDeliverableSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Usuário não autenticado.");

      // normaliza links
      const cleanLinks = links.map((x) => (x || "").trim()).filter((x) => x.length > 0);

      const payload: any = {
        campaign_id: props.campaignId,
        creator_id: auth.user.id,
        status: nextStatus,
        checklist: checklist || {},
        links: cleanLinks,
        notes: notes?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (nextStatus === "submitted") payload.submitted_at = new Date().toISOString();

      const { error } = await supabase
        .from("campaign_creator_deliverables")
        .upsert(payload, { onConflict: "campaign_id,creator_id" });

      if (error) throw error;

      setDeliverableStatus(nextStatus);
      toast.success(nextStatus === "submitted" ? "Entregas enviadas para revisão!" : "Rascunho salvo.");
    } catch (e: any) {
      console.error("SAVE_DELIVERABLES_ERROR", e);
      toast.error(e?.message || "Erro ao salvar entregas.");
    } finally {
      setDeliverableSaving(false);
    }
  };

  const submitForReview = async () => {
    if (!window.confirm("Enviar entregas para revisão?\n\nDepois disso, o contratante poderá conferir e aprovar sua participação.")) return;

    setDeliverableSubmitting(true);
    try {
      await saveDeliverables("submitted");
    } finally {
      setDeliverableSubmitting(false);
    }
  };

  // Se influencer não aceitou, bloqueia tudo
  if (props.role === "influencer" && !props.influencerAccepted) {
    return (
      <GlassCard>
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-foreground">Arquivos e entregas</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Você verá os arquivos e poderá enviar entregas após confirmar participação.
            </div>
          </div>
        </div>
      </GlassCard>
    );
  }

  const statusChip = deliverableStatusUi(deliverableStatus);

  return (
    <div className="space-y-4">
      {/* Editor de entregas (SÓ influencer aceita) */}
      {props.role === "influencer" && props.influencerAccepted && (
        <GlassCard className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Confirmações e comprovação</div>
              <div className="text-xs text-muted-foreground mt-1">
                Marque o que foi feito, adicione links e notas. Depois envie para revisão.
              </div>
            </div>

            <span className={`text-[10px] px-2 py-1 rounded-full border ${statusChip.cls}`}>{statusChip.text}</span>
          </div>

          {deliverableLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : (
            <>
              {/* Checklist */}
              <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5" />
                  Checklist
                </div>

                <div className="space-y-2">
                  {checklistTemplate.map((it) => {
                    const done = !!checklist[it.key];
                    return (
                      <button
                        key={it.key}
                        type="button"
                        onClick={() => setChecklist((prev) => ({ ...prev, [it.key]: !prev[it.key] }))}
                        className="w-full text-left flex items-center gap-2 rounded-xl border border-border/40 bg-white/5 px-3 py-2 hover:bg-white/10 transition"
                      >
                        {done ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                        <span className={`text-sm ${done ? "text-foreground/85" : "text-muted-foreground"}`}>{it.label}</span>
                        {it.required && <span className="ml-auto text-[10px] text-muted-foreground">Obrigatório</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Links */}
              <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <LinkIcon className="w-3.5 h-3.5" />
                  Links de comprovação
                </div>

                <div className="space-y-2">
                  {links.map((v, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={v}
                        onChange={(e) => updateLink(idx, e.target.value)}
                        placeholder="https://instagram.com/p/..."
                        className="w-full rounded-xl border border-border/50 bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                      />
                      {links.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLink(idx)}
                          className="rounded-xl border border-border/50 bg-white/5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/10 transition"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addLinkRow}
                    className="rounded-xl border border-border/50 bg-white/5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/10 transition"
                  >
                    + Adicionar link
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-2">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Notas</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex.: explique detalhes da entrega, horários, observações..."
                  className="w-full min-h-[96px] rounded-xl border border-border/50 bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => saveDeliverables("draft")}
                  disabled={deliverableSaving || deliverableSubmitting}
                  className="flex-1 rounded-xl border border-border/50 bg-white/5 px-3 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-white/10 transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {deliverableSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar rascunho
                </button>

                <button
                  type="button"
                  onClick={submitForReview}
                  disabled={deliverableSaving || deliverableSubmitting}
                  className="flex-1 rounded-xl border border-primary/30 bg-primary/10 px-3 py-3 text-sm font-semibold text-primary hover:bg-primary/15 transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {deliverableSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar p/ revisão
                </button>
              </div>
            </>
          )}
        </GlassCard>
      )}

      {/* Header de arquivos */}
      <GlassCard className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">Arquivos</div>
          <div className="text-xs text-muted-foreground">
            {props.role === "contractor"
              ? "Visualize os assets e as entregas enviadas pelos creators."
              : "Baixe os assets e envie arquivos de comprovação (prints/PDF)."}
          </div>
        </div>

        {(canUploadAssets || canUploadDeliverables) && (
          <button
            onClick={handlePickUpload}
            disabled={uploading}
            className="rounded-xl bg-white/5 border border-border/50 px-3 py-2 text-sm hover:bg-white/10 transition flex items-center gap-2 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <Upload className="w-4 h-4 text-primary" />}
            Enviar
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => handleUploadFile(e.target.files?.[0])}
        />
      </GlassCard>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {visibleKinds.map((k) => (
            <GlassCard key={k} className="space-y-3">
              <div className="text-sm font-semibold text-foreground">{kindLabel(k)}</div>

              {grouped[k].length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {k === "assets" ? "Nenhum arquivo de briefing/arte foi enviado." : "Nenhuma entrega foi enviada."}
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