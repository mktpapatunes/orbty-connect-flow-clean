import { useEffect, useState } from "react";
import MobileLayout from "@/components/MobileLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function InfluencerPersonalData() {
  const { user, profile, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // tenta buscar colunas (se não existirem, não quebra o app)
        const { data, error } = await supabase
          .from("profiles")
          .select("email, phone")
          .eq("id", user.id)
          .maybeSingle();

        if (!alive) return;

        if (error) {
          // se seu schema não tem email/phone no profiles, apenas mostra vazio e segue
          console.warn("PERSONAL_DATA_FETCH_WARN", error);
          setEmail("");
          setPhone("");
          setLoading(false);
          return;
        }

        setEmail(String((data as any)?.email ?? ""));
        setPhone(String((data as any)?.phone ?? ""));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;

    setSaving(true);
    try {
      const payload: any = {
        email: email.trim() || null,
        phone: phone.trim() || null,
      };

      const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
      if (error) throw error;

      toast.success("Dados pessoais atualizados!");
      await refreshProfile?.();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar dados pessoais.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileLayout title="Dados pessoais" showBack backTo="/perfil-influenciadora" navType="influencer" showNav={false}>
      <div className="px-6 py-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              <div className="text-sm font-semibold text-foreground">Informações privadas</div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" className="text-sm" />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-sm glow-blue flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Salvando..." : "Salvar"}
            </button>

            <div className="text-xs text-muted-foreground">
              Esses dados são privados. Terceiros não têm acesso.
            </div>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}