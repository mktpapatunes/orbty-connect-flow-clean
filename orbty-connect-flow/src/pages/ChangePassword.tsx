import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Lock, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import NetworkBackground from "@/components/NetworkBackground";
import { supabase } from "@/integrations/supabase/client";
import { translateSupabaseError } from "@/utils/supabaseErrorTranslator";

const MIN_PASSWORD_LENGTH = 6;

export default function ChangePassword() {
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordsMatch = useMemo(
    () => newPassword.length > 0 && newPassword === confirmPassword,
    [newPassword, confirmPassword]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (!passwordsMatch) {
      toast.error("As senhas não conferem.");
      return;
    }

    try {
      setIsSubmitting(true);

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error(translateSupabaseError(error.message));
        return;
      }

      setSuccess(true);
      toast.success("Senha atualizada com sucesso.");
    } catch (error) {
      toast.error("Não foi possível atualizar sua senha.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="mobile-container flex flex-col items-center justify-center bg-background text-center px-8">
        <CheckCircle2 className="w-14 h-14 text-primary mb-4" />

        <h1 className="text-xl font-bold text-foreground mb-2">
          Senha alterada com sucesso
        </h1>

        <p className="text-sm text-muted-foreground mb-8">
          Sua nova senha já está ativa.
        </p>

        <button
          onClick={() => navigate("/configuracoes")}
          className="w-full max-w-xs py-4 rounded-xl bg-gradient-neon text-primary-foreground font-semibold"
        >
          Voltar para configurações
        </button>
      </div>
    );
  }

  return (
    <div className="mobile-container relative flex flex-col bg-background">
      <NetworkBackground />

      <div className="relative z-10 pt-16 pb-8 px-8">
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">
          Alterar <span className="text-gradient-neon">senha</span>
        </h1>

        <p className="text-muted-foreground text-sm">
          Escolha uma nova senha para sua conta.
        </p>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="relative z-10 px-8 space-y-4"
      >
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="password"
            placeholder="Nova senha"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-secondary/50 border border-border/50 text-sm"
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="password"
            placeholder="Confirmar nova senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-secondary/50 border border-border/50 text-sm"
          />
        </div>

        {newPassword && confirmPassword && (
          <p className={`text-xs ${passwordsMatch ? "text-primary" : "text-red-400"}`}>
            {passwordsMatch ? "As senhas conferem" : "As senhas não conferem"}
          </p>
        )}

        <motion.button
          type="submit"
          disabled={isSubmitting}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-4 rounded-xl bg-gradient-neon text-primary-foreground font-semibold flex items-center justify-center gap-2"
        >
          {isSubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : "Salvar nova senha"}
        </motion.button>
      </motion.form>
    </div>
  );
}