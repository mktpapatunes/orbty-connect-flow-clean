import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Link as LinkIcon,
  CheckSquare,
  Square,
  Send,
  FileText,
  ShieldCheck,
  Paperclip,
  BadgeCheck,
} from "lucide-react";
import CampaignFilesTab from "@/components/campaign/CampaignFilesTab";

type DeliverablesRow = {
  id?: string;
  campaign_id: string;
  creator_id: string;
  status: "draft" | "submitted" | "approved" | "changes_requested";
  checklist: Record<string, boolean> | null;
  links: string[] | null;
  notes: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const CHECKLIST_ITEMS: Array<{ key: string; label: string }> = [
  { key: "posts_done", label: "Realizei os posts combinados" },
  { key: "format_done", label: "Entreguei no formato combinado" },
  { key: "mentions_done", label: "Fiz as menções solicitadas" },
  { key: "hashtags_done", label: "Usei as hashtags solicitadas" },
  { key: "caption_done", label: "Usei a legenda solicitada" },
  { key: "collab_done", label: "Publicação em collab realizada (se aplicável)" },
  { key: "proof_files", label: "Anexei prints/arquivos de comprovação" },
  { key: "proof_links", label: "Adicionei link(s) da(s) publicação(ões)" },
];

function normalizeLinks(input: string[]): string[] {
  return (input || [])
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .filter((s) => s.length >= 6);
}

export default function CreatorDeliverablesPanel(props: {
  campaignId: string;
  creatorAccepted: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [row, setRow] = useState<DeliverablesRow | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [links, setLinks] = useState<string[]>([""]);
  const [notes, setNotes] = useState<string>("");

  const isApproved = row?.status === "approved";
  const isSubmitted = row?.status === "submitted";

  const canEdit = props.creatorAccepted && !isApproved && !isSubmitted;
  const canSubmit = props.creatorAccepted && !isApproved && !isSubmitted;

  const statusLabel = useMemo(() => {
    const s = row?.status;
    if (!s) return "Em rascunho";
    if (s === "draft") return "Em rascunho";
    if (s === "submitted") return "Entregue, aguardando confirmação";
    if (s === "approved") return "Aprovado";
    if (s === "changes_requested") return "Ajustes solicitados";
    return s;
  }, [row?.status]);

  const fetchRow = async () => {
    setLoading(true);

    try {
      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) throw new Error("Usuário não autenticado.");

      const creatorId = auth.user.id;

      const { data, error } = await supabase
        .from("campaign_creator_deliverables")
        .select("*")
        .eq("campaign_id", props.campaignId)
        .eq("creator_id", creatorId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const r = data as DeliverablesRow;

        setRow(r);
        setChecklist(r.checklist ?? {});
        setLinks(Array.isArray(r.links) && r.links.length ? r.links : [""]);
        setNotes(r.notes ?? "");
      } else {
        setRow(null);
        setChecklist({});
        setLinks([""]);
        setNotes("");
      }
    } catch (e: any) {
      console.error("FETCH_DELIVERABLES_ERROR", e);
      toast.error(e?.message || "Erro ao carregar entregas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.campaignId]);

  const toggleChecklist = (key: string) => {
    if (!canEdit) return;

    setChecklist((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSaveDraft = async () => {
    if (!props.creatorAccepted) {
      toast.error("Você precisa confirmar participação.");
      return;
    }

    if (!canEdit) return;

    setSaving(true);

    try {
      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) throw new Error("Usuário não autenticado.");

      const creatorId = auth.user.id;
      const updatedAt = new Date().toISOString();

      const payload = {
        campaign_id: props.campaignId,
        creator_id: creatorId,
        status: "draft" as const,
        checklist: checklist ?? {},
        links: normalizeLinks(links),
        notes: notes.trim() || null,
        updated_at: updatedAt,
      };

      const { error } = await supabase
        .from("campaign_creator_deliverables")
        .upsert(payload, { onConflict: "campaign_id,creator_id" });

      if (error) throw error;

      toast.success("Rascunho salvo.");
      await fetchRow();
    } catch (e: any) {
      console.error("SAVE_DRAFT_ERROR", e);
      toast.error(e?.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!props.creatorAccepted) {
      toast.error("Você precisa confirmar participação.");
      return;
    }

    if (!canSubmit) return;

    const hasSomeProof =
      normalizeLinks(links).length > 0 ||
      !!checklist.proof_files ||
      !!checklist.proof_links;

    if (!hasSomeProof) {
      toast.error("Adicione pelo menos 1 link ou comprovação.");
      return;
    }

    if (!window.confirm("Enviar entregas?\n\nApós enviar, ficará bloqueado até a confirmação do contratante.")) {
      return;
    }

    setSubmitting(true);

    try {
      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) throw new Error("Usuário não autenticado.");

      const creatorId = auth.user.id;
      const submittedAt = new Date().toISOString();

      const payload = {
        campaign_id: props.campaignId,
        creator_id: creatorId,
        status: "submitted" as const,
        checklist: checklist ?? {},
        links: normalizeLinks(links),
        notes: notes.trim() || null,
        submitted_at: submittedAt,
        updated_at: submittedAt,
      };

      const { error: deliverablesError } = await supabase
        .from("campaign_creator_deliverables")
        .upsert(payload, { onConflict: "campaign_id,creator_id" });

      if (deliverablesError) throw deliverablesError;

      const { data: participantRows, error: participantError } = await supabase
        .from("campaign_participants")
        .update({
          status: "delivered",
          delivered_at: submittedAt,
        })
        .eq("campaign_id", props.campaignId)
        .eq("influencer_id", creatorId)
        .select("campaign_id, influencer_id, status, delivered_at");

      if (participantError) throw participantError;

      if (!participantRows || participantRows.length === 0) {
        throw new Error("A participação não foi atualizada para entregue.");
      }

      toast.success("Entregas enviadas! Agora aguarde a confirmação do contratante.");
      await fetchRow();
    } catch (e: any) {
      console.error("SUBMIT_DELIVERABLES_ERROR", e);
      toast.error(e?.message || "Erro ao enviar entregas.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!props.creatorAccepted) {
    return (
      <div className="glass-card p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-foreground">Entregas</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Confirme sua participação para habilitar o envio de entregas.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass-card p-6 flex justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">Checklist e comprovação</div>
            <div className="text-xs text-muted-foreground mt-1">
              Status: <span className="text-foreground/80 font-medium">{statusLabel}</span>
            </div>
          </div>

          {canEdit ? (
            <button
              onClick={handleSaveDraft}
              disabled={saving || submitting}
              className="rounded-2xl border border-border/50 bg-card/60 px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-card/80 transition disabled:opacity-60"
              title="Salvar"
              type="button"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          ) : isSubmitted ? (
            <div className="rounded-2xl border border-warning/25 bg-warning/10 px-3 py-2 text-[11px] font-semibold text-warning">
              Aguardando confirmação
            </div>
          ) : isApproved ? (
            <div className="rounded-2xl border border-accent/25 bg-accent/10 px-3 py-2 text-[11px] font-semibold text-accent">
              Confirmado
            </div>
          ) : null}
        </div>

        <div className="mt-4 space-y-2">
          {CHECKLIST_ITEMS.map((it) => {
            const checked = !!checklist[it.key];
            return (
              <button
                key={it.key}
                type="button"
                onClick={() => toggleChecklist(it.key)}
                disabled={!canEdit}
                className={`w-full text-left flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                  checked
                    ? "border-accent/25 bg-accent/10"
                    : "border-border/50 bg-white/5 hover:bg-white/10"
                } ${!canEdit ? "opacity-70 cursor-default" : ""}`}
              >
                {checked ? (
                  <CheckSquare className="w-4 h-4 text-accent" />
                ) : (
                  <Square className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm text-foreground/85">{it.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center gap-2">
          <LinkIcon className="w-4 h-4 text-primary" />
          <div className="text-sm font-semibold text-foreground">Links de comprovação</div>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Cole aqui links dos posts/stories para validação.
        </div>

        <div className="mt-3 space-y-2">
          {links.map((val, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                value={val}
                onChange={(e) =>
                  setLinks((prev) => {
                    const copy = [...prev];
                    copy[idx] = e.target.value;
                    return copy;
                  })
                }
                disabled={!canEdit}
                placeholder="https://..."
                className="w-full rounded-2xl border border-border/50 bg-card/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-70"
              />
              {canEdit && (
                <button
                  type="button"
                  onClick={() =>
                    setLinks((prev) => {
                      const copy = [...prev];
                      copy.splice(idx, 1);
                      return copy.length ? copy : [""];
                    })
                  }
                  className="w-10 h-10 rounded-2xl border border-border/50 bg-card/60 hover:bg-card/80 transition text-muted-foreground hover:text-foreground"
                  title="Remover"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => setLinks((prev) => [...prev, ""])}
            className="mt-3 text-xs font-semibold text-primary hover:opacity-80 transition"
          >
            + Adicionar outro link
          </button>
        )}
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-primary" />
          <div className="text-sm font-semibold text-foreground">Arquivos de comprovação</div>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Envie prints, PDFs ou outros arquivos que comprovem a entrega.
        </div>

        <div className="mt-3">
          <CampaignFilesTab
            campaignId={props.campaignId}
            role="influencer"
            influencerAccepted={props.creatorAccepted}
            kindFilter="deliverables"
            readOnly={!canEdit}
          />
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent" />
          <div className="text-sm font-semibold text-foreground">Observações</div>
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={!canEdit}
          rows={4}
          placeholder="Conte qualquer detalhe relevante para a revisão..."
          className="mt-3 w-full rounded-2xl border border-border/50 bg-card/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-70"
        />
      </div>

      <div className="glass-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">Enviar entregas</div>
            <div className="text-xs text-muted-foreground mt-1">
              Após enviar, seu conteúdo ficará bloqueado até a confirmação do contratante.
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting || saving}
            className={`rounded-2xl px-4 py-2 text-xs font-semibold transition flex items-center gap-2 ${
              isApproved
                ? "border border-accent/25 bg-accent/10 text-accent cursor-default"
                : isSubmitted
                  ? "border border-warning/25 bg-warning/10 text-warning cursor-default"
                  : "bg-gradient-neon text-primary-foreground glow-blue"
            } disabled:opacity-60`}
            title="Enviar entregas"
            type="button"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isApproved ? (
              <BadgeCheck className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {isApproved ? "Confirmado" : isSubmitted ? "Entregue" : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}