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

      const payload = {
        campaign_id: props.campaignId,
        creator_id: creatorId,
        status: "draft",
        checklist: checklist ?? {},
        links: normalizeLinks(links),
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
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

    setSubmitting(true);

    try {
      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) throw new Error("Usuário não autenticado.");

      const creatorId = auth.user.id;

      const payload = {
        campaign_id: props.campaignId,
        creator_id: creatorId,
        status: "submitted",
        checklist: checklist ?? {},
        links: normalizeLinks(links),
        notes: notes.trim() || null,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("campaign_creator_deliverables")
        .upsert(payload, { onConflict: "campaign_id,creator_id" });

      if (error) throw error;

      toast.success("Entregas enviadas!");

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
            <div className="text-sm font-semibold text-foreground">
              Entregas
            </div>
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

      {/* restante da UI permanece igual */}

      <div className="glass-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">
              Enviar entregas
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting || saving}
            className="bg-gradient-neon text-primary-foreground px-4 py-2 rounded-2xl text-xs font-semibold flex items-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}