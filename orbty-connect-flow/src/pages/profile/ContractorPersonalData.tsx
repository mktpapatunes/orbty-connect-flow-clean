import { useEffect, useState } from "react";
import MobileLayout from "@/components/MobileLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ContractorPersonalRow = {
  user_id: string;
  full_name: string | null;
  role_title: string | null;
  email: string | null;
  phone: string | null;
};

export default function ContractorPersonalData() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
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
        const { data, error } = await supabase
          .from("contractor_personal_data")
          .select("user_id, full_name, role_title, email, phone")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!alive) return;

        if (error) {
          console.warn("CONTRACTOR_PERSONAL_FETCH_WARN", error);
          setFullName("");
          setRoleTitle("");
          setEmail("");
          setPhone("");
          setLoading(false);
          return;
        }

        const row = (data as ContractorPersonalRow | null) ?? null;

        setFullName(String(row?.full_name ?? ""));
        setRoleTitle(String(row?.role_title ?? ""));
        setEmail(String(row?.email ?? ""));
        setPhone(String(row?.phone ?? ""));
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
      const payload = {
        user_id: user.id,
        full_name: fullName.trim() || null,
        role_title: roleTitle.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
      };

      // ✅ upsert: cria se não existir, atualiza se existir
      const { error } = await supabase
        .from("contractor_personal_data")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;

      toast.success("Dados pessoais atualizados!");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar dados pessoais.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileLayout title="Dados pessoais" showBack backTo="/perfil-contratante" navType="contractor" showNav={false}>
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
              <Label className="text-xs text-muted-foreground">Nome da pessoa</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" className="text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Função / Cargo</Label>
              <Input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="Ex: Marketing, Dono(a), Social Media" className="text-sm" />
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