import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, Download, Trash2, FileText, Image as ImageIcon, ShieldCheck } from "lucide-react";
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

export default function CampaignFilesTab(props: {
  campaignId: string;
  role: "contractor" | "influencer";
  // true quando influencer foi aceita (p/ permitir upload deliverables e ver assets)
  influencerAccepted: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CampaignFileItem[]>([]);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);

  const canUploadAssets = props.role === "contractor";
  const canUploadDeliverables = props.role === "influencer" && props.influencerAccepted;

  const visibleKinds = useMemo(() => {
    if (props.role === "contractor") return ["assets", "deliverables"] as CampaignFileKind[];
    // influencer: vê assets se aceita; e vê suas entregas (RLS garante)
    return props.influencerAccepted ? (["assets", "deliverables"] as CampaignFileKind[]) : ([] as CampaignFileKind[]);
  }, [props.role, props.influencerAccepted]);

  const grouped = useMemo(() => {
    const map: Record<CampaignFileKind, CampaignFileItem[]> = { assets: [], deliverables: [] };
    for (const it of items) map[it.kind].push(it);
    return map;
  }, [items]);

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

  useEffect(() => {
    refetch();
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

    // define kind automaticamente:
    // contractor -> assets
    // influencer -> deliverables
    const kind: CampaignFileKind = props.role === "contractor" ? "assets" : "deliverables";

    if (kind === "deliverables" && !props.influencerAccepted) {
      toast.error("Você precisa ser aceita para enviar entregas.");
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

      toast.success(kind === "assets" ? "Arquivo enviado para Assets!" : "Entrega enviada!");
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
    // RLS já decide, mas escondemos botão por UX:
    // contractor pode deletar assets e deliverables (da campanha dele)
    if (props.role === "contractor") return true;
    // influencer só deletaria as próprias entregas (RLS garante). UI simplificada: deixa.
    return props.role === "influencer" && it.kind === "deliverables";
  };

  if (props.role === "influencer" && !props.influencerAccepted) {
    return (
      <GlassCard>
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-foreground">Arquivos da campanha</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Você verá os arquivos e poderá enviar entregas após ser aceita na campanha.
            </div>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <GlassCard className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">Arquivos</div>
          <div className="text-xs text-muted-foreground">
            Assets (briefing/arte) e entregas (prints/comprovação).
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
                  {k === "assets"
                    ? "Nenhum arquivo de briefing/arte foi enviado ainda."
                    : "Nenhuma entrega foi enviada ainda."}
                </div>
              ) : (
                <div className="space-y-2">
                  {grouped[k].map((it) => (
                    <div key={it.path} className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-white/5 p-3">
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