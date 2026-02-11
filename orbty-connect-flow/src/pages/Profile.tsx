import { useState, useEffect } from "react";
import MobileLayout from "@/components/MobileLayout";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useAuth } from "@/contexts/AuthContext";
import { User, Mail, MapPin, Phone, Instagram, Loader2, Save, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const CONTENT_STYLES = [
  { value: "lifestyle", label: "Lifestyle" },
  { value: "humor", label: "Humor" },
  { value: "danca", label: "Dança" },
  { value: "entretenimento", label: "Entretenimento" },
  { value: "dicas", label: "Dicas" },
];

const GENDERS = [
  { value: "feminino", label: "Feminino" },
  { value: "masculino", label: "Masculino" },
  { value: "nao_binario", label: "Não-binário" },
  { value: "prefiro_nao_dizer", label: "Prefiro não dizer" },
];

const Profile = () => {
  const { profile, userRole, approvalStatus, refreshProfile } = useAuth();
  const isVerifiedInfluencer = userRole === "influencer" && approvalStatus === "approved";
  const isInfluencer = userRole === "influencer";

  const [stats, setStats] = useState({ campaigns: 0, totalValue: "R$ 0" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Editable fields
  const [form, setForm] = useState({
    name: "",
    bio: "",
    avatar_url: "",
    neighborhood: "",
    age: "",
    gender: "",
    content_style: "",
    audience_female: 50,
  });

  // Load profile data into form
  useEffect(() => {
    if (profile) {
      const p = profile as any;
      const ag = p.audience_gender || { female: 50, male: 50 };
      setForm({
        name: p.name || "",
        bio: p.bio || "",
        avatar_url: p.avatar_url || "",
        neighborhood: p.neighborhood || "",
        age: p.age ? String(p.age) : "",
        gender: p.gender || "",
        content_style: p.content_style || "",
        audience_female: ag.female ?? 50,
      });
    }
  }, [profile]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!profile) return;
      try {
        if (userRole === "contractor") {
          const { data } = await supabase.rpc("get_my_campaigns" as any);
          setStats({ campaigns: ((data || []) as any[]).length, totalValue: "—" });
        } else if (userRole === "influencer") {
          const { data } = await supabase
            .from("campaign_applications")
            .select("campaign_id, status")
            .eq("influencer_id", profile.id)
            .eq("status", "accepted");
          setStats({ campaigns: (data || []).length, totalValue: "—" });
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, [profile, userRole]);

  const handleSave = async () => {
    // Validate
    const age = form.age ? parseInt(form.age) : null;
    if (age !== null && (age < 13 || age > 99)) {
      toast.error("Idade deve ser entre 13 e 99 anos.");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await (supabase.rpc as any)("update_my_profile", {
        p_avatar_url: form.avatar_url || null,
        p_name: form.name || null,
        p_bio: form.bio || null,
        p_neighborhood: form.neighborhood || null,
        p_age: age,
        p_gender: form.gender || null,
        p_content_style: form.content_style || null,
        p_audience_gender: JSON.stringify({
          female: form.audience_female,
          male: 100 - form.audience_female,
        }),
      });

      if (error) {
        toast.error(error.message || "Erro ao salvar perfil.");
      } else {
        toast.success("Perfil atualizado!");
        setIsEditing(false);
        await refreshProfile();
      }
    } catch {
      toast.error("Erro ao salvar perfil.");
    } finally {
      setIsSaving(false);
    }
  };

  const navType = userRole === "influencer" ? "influencer" : "contractor";

  return (
    <MobileLayout title="Meu perfil" showBack navType={navType as "contractor" | "influencer"}>
      <div className="px-6 py-6 space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            {form.avatar_url ? (
              <img
                src={form.avatar_url}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover border-2 border-primary/30"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-neon-subtle flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
            )}
            {isEditing && (
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                <Camera className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
            )}
          </div>
          <div className="text-center">
            <h3 className="font-display font-bold text-foreground text-lg">
              {profile?.name || "Usuário Orbty"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {userRole === "influencer" ? "Creator" : "Contratante"}
            </p>
            {isVerifiedInfluencer && (
              <div className="mt-2 flex justify-center">
                <VerifiedBadge size="lg" />
              </div>
            )}
          </div>
        </div>

        {/* Edit toggle */}
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="w-full py-3 rounded-xl border border-primary/30 text-primary font-medium text-sm"
          >
            Editar perfil
          </button>
        ) : (
          <div className="space-y-4">
            {/* Avatar URL */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">URL da foto de perfil</Label>
              <Input
                value={form.avatar_url}
                onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                placeholder="https://..."
                className="text-sm"
              />
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="text-sm"
              />
            </div>

            {/* Bio */}
            {isInfluencer && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Bio</Label>
                <Textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="Conte um pouco sobre você..."
                  className="text-sm"
                  rows={3}
                />
              </div>
            )}

            {/* Neighborhood */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Bairro</Label>
              <Input
                value={form.neighborhood}
                onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
                placeholder="Seu bairro"
                className="text-sm"
              />
            </div>

            {isInfluencer && (
              <>
                {/* Age */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Idade</Label>
                  <Input
                    type="number"
                    min={13}
                    max={99}
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                    placeholder="Idade"
                    className="text-sm"
                  />
                </div>

                {/* Gender */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Gênero</Label>
                  <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((g) => (
                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Content Style */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Estilo de conteúdo</Label>
                  <Select value={form.content_style} onValueChange={(v) => setForm({ ...form, content_style: v })}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_STYLES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Audience Gender Slider */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Público (gênero)</Label>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Feminino: {form.audience_female}%</span>
                    <span>Masculino: {100 - form.audience_female}%</span>
                  </div>
                  <Slider
                    value={[form.audience_female]}
                    onValueChange={(v) => setForm({ ...form, audience_female: v[0] })}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>
              </>
            )}

            {/* Save / Cancel */}
            <div className="flex gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 py-3 rounded-xl border border-border/50 text-muted-foreground font-medium text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-[2] py-3 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-sm glow-blue flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        )}

        {/* Info (read-only view when not editing) */}
        {!isEditing && (
          <div className="space-y-3">
            <div className="glass-card p-4 flex items-center gap-3">
              <Mail className="w-4 h-4 text-primary" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm text-foreground">{profile?.email || "—"}</p>
              </div>
            </div>
            <div className="glass-card p-4 flex items-center gap-3">
              <Phone className="w-4 h-4 text-accent" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Telefone</p>
                <p className="text-sm text-foreground">{profile?.phone || "—"}</p>
              </div>
            </div>
            <div className="glass-card p-4 flex items-center gap-3">
              <MapPin className="w-4 h-4 text-accent" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Localização</p>
                <p className="text-sm text-foreground">
                  {profile ? `${profile.city}, ${profile.state}` : "—"}
                </p>
              </div>
            </div>
            {profile?.instagram && (
              <div className="glass-card p-4 flex items-center gap-3">
                <Instagram className="w-4 h-4 text-primary" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Instagram</p>
                  <p className="text-sm text-foreground">{profile.instagram}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="glass-card p-5 space-y-3">
          <h4 className="font-semibold text-foreground text-sm">Resumo da conta</h4>
          {isLoading ? (
            <div className="flex justify-center py-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {userRole === "influencer" ? "Campanhas aceitas" : "Campanhas criadas"}
                </span>
                <span className="text-foreground font-medium">{stats.campaigns}</span>
              </div>
              {userRole === "contractor" && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total investido</span>
                  <span className="text-gradient-neon font-bold">{stats.totalValue}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </MobileLayout>
  );
};

export default Profile;
