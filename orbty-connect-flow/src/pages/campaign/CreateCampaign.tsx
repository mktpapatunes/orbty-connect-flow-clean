import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Calendar, Music, ShoppingBag, MapPin, Upload, FileText, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import MobileLayout from "@/components/MobileLayout";
import CampaignProgress from "@/components/CampaignProgress";
import { useCampaign } from "@/contexts/CampaignContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const states = ["São Paulo", "Rio de Janeiro", "Minas Gerais", "Bahia", "Paraná", "Rio Grande do Sul", "Ceará", "Pernambuco", "Goiás", "Pará"];

const cities: Record<string, string[]> = {
  "São Paulo": ["São Paulo", "Campinas", "Santos", "Ribeirão Preto"],
  "Rio de Janeiro": ["Rio de Janeiro", "Niterói", "Petrópolis"],
  "Minas Gerais": ["Belo Horizonte", "Uberlândia", "Juiz de Fora"],
  "Bahia": ["Salvador", "Feira de Santana", "Ilhéus"],
  "Paraná": ["Curitiba", "Londrina", "Maringá"],
  "Rio Grande do Sul": ["Porto Alegre", "Caxias do Sul", "Pelotas"],
  "Ceará": ["Fortaleza", "Juazeiro do Norte", "Sobral"],
  "Pernambuco": ["Recife", "Olinda", "Caruaru"],
  "Goiás": ["Goiânia", "Aparecida de Goiânia", "Anápolis"],
  "Pará": ["Belém", "Ananindeua", "Santarém"],
};

const campaignTypes = [
  { id: "event", label: "Evento", icon: Calendar },
  { id: "music", label: "Música", icon: Music },
  { id: "product", label: "Marca / Produto", icon: ShoppingBag },
];

interface UploadedFile {
  file: File;
  preview?: string;
}

const CreateCampaign = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, updateData, resetData } = useCampaign();
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split("T")[0];

  // ✅ Formata datas para pt-BR (DD/MM/AAAA) sem bug de fuso em YYYY-MM-DD
  const formatDateBR = (value?: string | null) => {
    if (!value) return "-";

    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const d = isDateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);

    if (Number.isNaN(d.getTime())) return "-";

    // Se for "date-only", força UTC pra não voltar um dia no Brasil
    return isDateOnly
      ? d.toLocaleDateString("pt-BR", { timeZone: "UTC" })
      : d.toLocaleDateString("pt-BR");
  };

  // Step 1 validation
  const canStep2 = data.title && data.campaignType && data.selectedState && data.selectedCity && data.applyDeadline && data.briefPublic;
  // Step 2 validation
  const canStep3 = data.posts >= 1;
  // Step 3 validation (can publish)
  const canPublish = canStep2 && canStep3;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;
    const newFiles: UploadedFile[] = Array.from(selected).map((file) => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePublish = async () => {
    if (!user || !canPublish) return;
    setIsSubmitting(true);

    try {
      const region = `${data.selectedCity}, ${data.selectedState}`;
      const requirements = {
        posts: data.posts,
        format: data.format,
        hashtags: data.hashtags ? data.hashtags.split(",").map((h) => h.trim()) : [],
        mentions: data.mentions ? data.mentions.split(",").map((m) => m.trim()) : [],
      };

      // 1. Create campaign via RPC
      const { data: campaignId, error: campaignError } = await supabase.rpc("create_campaign", {
        payload: {
          title: data.title,
          type: data.campaignType,
          region,
          state: data.selectedState,
          city: data.selectedCity,
          campaign_date: data.campaignDate || null,
          apply_deadline: data.applyDeadline,
          brief_public: data.briefPublic,
          brief_private: data.briefPrivate || null,
          requirements,
        },
      });

      if (campaignError) {
        console.error("CREATE_CAMPAIGN_ERROR", campaignError);
        throw campaignError;
      }

      // 2. Upload files
      for (const { file } of files) {
        const path = `${campaignId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("campaign-assets")
          .upload(path, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        await supabase.from("campaign_assets").insert({
          campaign_id: campaignId,
          path,
          label: file.name,
          mime: file.type,
          size: file.size,
        } as any);
      }

      toast.success("Campanha publicada com sucesso!");
      resetData();
      navigate("/dashboard-contratante");
    } catch (error: any) {
      console.error("CREATE_CAMPAIGN_ERROR", error);
      toast.error(error.message || "Erro ao criar campanha. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MobileLayout title="Nova campanha" showBack backTo="/dashboard-contratante" showNav={false} showHome homeRoute="/dashboard-contratante">
      <CampaignProgress currentStep={step} />

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div className="px-6 py-4 space-y-4">
          <h3 className="font-display text-xl font-bold text-foreground">Informações da campanha</h3>

          {/* Title */}
          <div>
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Título</label>
            <input
              type="text"
              value={data.title}
              onChange={(e) => updateData({ title: e.target.value })}
              placeholder="Ex: Festa de lançamento XYZ"
              className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {campaignTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => updateData({ campaignType: type.id })}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    data.campaignType === type.id
                      ? "border-primary/60 bg-primary/5 text-primary"
                      : "border-border/50 bg-card/60 text-foreground/70"
                  }`}
                >
                  <type.icon className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* State */}
          <div>
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Estado</label>
            <div className="grid grid-cols-2 gap-2">
              {states.map((state) => (
                <button
                  key={state}
                  onClick={() => updateData({ selectedState: state, selectedCity: "" })}
                  className={`p-2.5 rounded-lg border text-xs text-left transition-all ${
                    data.selectedState === state
                      ? "border-primary/60 bg-primary/5 text-primary"
                      : "border-border/50 bg-card/60 text-foreground/70"
                  }`}
                >
                  <MapPin className="w-3 h-3 inline mr-1" />
                  {state}
                </button>
              ))}
            </div>
          </div>

          {/* City */}
          {data.selectedState && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Cidade</label>
              <div className="grid grid-cols-2 gap-2">
                {cities[data.selectedState]?.map((city) => (
                  <button
                    key={city}
                    onClick={() => updateData({ selectedCity: city })}
                    className={`p-2.5 rounded-lg border text-xs text-left transition-all ${
                      data.selectedCity === city
                        ? "border-primary/60 bg-primary/5 text-primary"
                        : "border-border/50 bg-card/60 text-foreground/70"
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Data do evento</label>
              <input
                type="date"
                value={data.campaignDate}
                min={today}
                onChange={(e) => updateData({ campaignDate: e.target.value })}
                className="w-full bg-input border border-border/50 rounded-xl px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Prazo candidatura *</label>
              <input
                type="date"
                value={data.applyDeadline}
                min={today}
                onChange={(e) => updateData({ applyDeadline: e.target.value })}
                className="w-full bg-input border border-border/50 rounded-xl px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Brief public */}
          <div>
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Descrição pública *</label>
            <textarea
              value={data.briefPublic}
              onChange={(e) => updateData({ briefPublic: e.target.value })}
              placeholder="Descreva a campanha para as influenciadoras verem no feed..."
              rows={3}
              className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
        </div>
      )}

      {/* Step 2: Requirements */}
      {step === 2 && (
        <div className="px-6 py-4 space-y-4">
          <h3 className="font-display text-xl font-bold text-foreground">Requisitos da campanha</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Nº de posts *</label>
              <input
                type="number"
                min={1}
                value={data.posts}
                onChange={(e) => updateData({ posts: parseInt(e.target.value) || 1 })}
                className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Formato</label>
              <select
                value={data.format}
                onChange={(e) => updateData({ format: e.target.value })}
                className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="stories">Stories</option>
                <option value="feed">Feed</option>
                <option value="reels">Reels</option>
                <option value="misto">Misto</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Hashtags (separadas por vírgula)</label>
            <input
              type="text"
              value={data.hashtags}
              onChange={(e) => updateData({ hashtags: e.target.value })}
              placeholder="#festa, #evento"
              className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Menções (separadas por vírgula)</label>
            <input
              type="text"
              value={data.mentions}
              onChange={(e) => updateData({ mentions: e.target.value })}
              placeholder="@marca, @evento"
              className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 block">Briefing privado (só para aceitas)</label>
            <textarea
              value={data.briefPrivate}
              onChange={(e) => updateData({ briefPrivate: e.target.value })}
              placeholder="Instruções detalhadas visíveis somente após aprovação..."
              rows={4}
              className="w-full bg-input border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
        </div>
      )}

      {/* Step 3: Files & Publish */}
      {step === 3 && (
        <div className="px-6 py-4 space-y-4">
          <h3 className="font-display text-xl font-bold text-foreground">Arquivos & Publicação</h3>

          {/* Upload area */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,.pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-border/60 rounded-xl p-6 flex flex-col items-center gap-2 text-center hover:border-primary/30 transition-colors"
          >
            <Upload className="w-7 h-7 text-muted-foreground" />
            <p className="text-sm text-foreground/80 font-medium">Enviar arquivos</p>
            <p className="text-xs text-muted-foreground/60">Imagens, vídeos ou PDFs</p>
          </button>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="glass-card p-3 flex items-center gap-3">
                  {f.preview ? (
                    <img src={f.preview} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground truncate">{f.file.name}</p>
                    <p className="text-[10px] text-muted-foreground">{(f.file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          <div className="glass-card p-4 space-y-2">
            <h4 className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Resumo</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Título</span><span className="text-foreground font-medium truncate ml-4">{data.title}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span className="text-foreground font-medium capitalize">{data.campaignType}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Região</span><span className="text-foreground font-medium">{data.selectedCity}, {data.selectedState}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Prazo</span><span className="text-foreground font-medium">{formatDateBR(data.applyDeadline)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Posts</span><span className="text-foreground font-medium">{data.posts}x {data.format}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Arquivos</span><span className="text-foreground font-medium">{files.length}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom navigation */}
      <div className="sticky bottom-0 px-6 py-4 bg-background/80 backdrop-blur-xl border-t border-border/30 flex gap-3">
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            className="flex-1 py-4 rounded-xl border border-border/50 text-muted-foreground font-medium text-sm"
          >
            Voltar
          </button>
        )}
        {step < 3 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={step === 1 ? !canStep2 : !canStep3}
            className={`flex-[2] py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              (step === 1 ? canStep2 : canStep3)
                ? "bg-gradient-neon text-primary-foreground glow-blue"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            Avançar
          </button>
        ) : (
          <button
            onClick={handlePublish}
            disabled={!canPublish || isSubmitting}
            className={`flex-[2] py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              canPublish && !isSubmitting
                ? "bg-gradient-neon text-primary-foreground glow-blue"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {isSubmitting ? "Publicando..." : "Publicar campanha"}
          </button>
        )}
      </div>
    </MobileLayout>
  );
};

export default CreateCampaign;