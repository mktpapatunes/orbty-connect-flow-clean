import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Lock, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import NetworkBackground from "@/components/NetworkBackground";
import { supabase } from "@/integrations/supabase/client";

const MIN_PASSWORD_LENGTH = 6;

const ResetPassword = () => {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const passwordsMatch = useMemo(
    () => password.length > 0 && password === confirmPassword,
    [password, confirmPassword]
  );

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      const hash = window.location.hash;
      const search = window.location.search;

      const hasRecoveryParams =
        hash.includes("type=recovery") ||
        hash.includes("access_token=") ||
        search.includes("type=recovery") ||
        search.includes("access_token=");

      const { data } = await supabase.auth.getSession();

      if (!mounted) return;

      if (data.session || hasRecoveryParams) {
        setSessionReady(true);
        return;
      }

      toast.error("Link de recuperação inválido ou expirado.");
      navigate("/login", { replace: true });
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    if (!passwordsMatch) {
      toast.error("As senhas não conferem.");
      return;
    }

    try {
      setIsSubmitting(true);

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        toast.error(error.message || "Não foi possível redefinir sua senha.");
        return;
      }

      toast.success("Senha redefinida com sucesso.");
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("[ResetPassword] update password error:", error);
      toast.error("Não foi possível redefinir sua senha.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!sessionReady) {
    return (
      <div className="mobile-container flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="mobile-container relative flex flex-col bg-background">
      <NetworkBackground />

      <div className="relative z-10 pt-16 pb-8 px-8">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-3xl font-bold text-foreground mb-2"
        >
          Redefinir <span className="text-gradient-neon">senha</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-muted-foreground text-sm"
        >
          Digite sua nova senha para acessar a Orbty
        </motion.p>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        onSubmit={handleSubmit}
        className="relative z-10 flex-1 px-8 space-y-4"
      >
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="password"
            placeholder="Nova senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="password"
            placeholder="Confirmar nova senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
          />
        </div>

        {password.length > 0 && confirmPassword.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className={`w-4 h-4 ${passwordsMatch ? "text-primary" : "text-muted-foreground"}`} />
            <span className={passwordsMatch ? "text-primary" : "text-muted-foreground"}>
              {passwordsMatch ? "As senhas conferem" : "As senhas não conferem"}
            </span>
          </div>
        )}

        <motion.button
          type="submit"
          disabled={isSubmitting}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-4 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-base tracking-wide glow-blue transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Salvar nova senha"}
        </motion.button>
      </motion.form>
    </div>
  );
};

export default ResetPassword;