import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import NetworkBackground from "@/components/NetworkBackground";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardRedirect } from "@/hooks/useDashboardRedirect";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const { session, loading, authReady, signIn, userRole, approvalStatus, isAdmin } = useAuth();
  const { redirectToDashboard } = useDashboardRedirect();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authReady || loading || !session) return;

    if (isAdmin) {
      redirectToDashboard();
      return;
    }

    if (approvalStatus === "pending" || approvalStatus === "rejected") {
      redirectToDashboard();
      return;
    }

    if (
      approvalStatus === "approved" &&
      (userRole === "contractor" || userRole === "influencer")
    ) {
      redirectToDashboard();
      return;
    }
  }, [authReady, loading, session, isAdmin, approvalStatus, userRole, redirectToDashboard]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast.error("Preencha email e senha");
      return;
    }

    setIsSubmitting(true);
    const result = await signIn(email.trim(), password);

    if (result.error) {
      const msg = result.error.toLowerCase();

      if (msg.includes("email not confirmed") || msg.includes("email_not_confirmed")) {
  toast.error("Confirme seu e-mail antes de entrar. Verifique Inbox/Spam.");
  navigate("/check-email?mode=signup&email=" + encodeURIComponent(email.trim()));
} else {
  toast.error(
    result.error === "Invalid login credentials"
      ? "Email ou senha incorretos"
      : result.error
  );
}

      setIsSubmitting(false);
    }
  };

  if (loading && !session) {
    return (
      <div className="mobile-container flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">
          {isSubmitting ? "Entrando…" : "Carregando…"}
        </p>
      </div>
    );
  }

  return (
    <div className="mobile-container relative flex flex-col bg-background">
      <NetworkBackground />

      <div className="relative z-10 pt-16 pb-8 px-8">
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => navigate("/welcome")}
          className="text-muted-foreground text-sm mb-12 hover:text-foreground transition-colors"
        >
          ← Voltar
        </motion.button>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-display text-3xl font-bold text-foreground mb-2"
        >
          Bem-vindo de volta ao <span className="text-gradient-neon">Orbty</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-muted-foreground text-sm"
        >
          Entre com seu email e senha
        </motion.p>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        onSubmit={handleLogin}
        className="relative z-10 flex-1 px-8 space-y-4"
      >
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="email"
            placeholder="Seu email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="password"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
          />
        </div>

        <div className="flex justify-end -mt-1">
          <button
            type="button"
            onClick={() => navigate("/recuperar-senha")}
            className="text-sm text-primary hover:underline"
          >
            Esqueci minha senha
          </button>
        </div>

        <motion.button
          type="submit"
          disabled={isSubmitting}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-4 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-base tracking-wide glow-blue transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Entrar
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-sm text-muted-foreground pt-4"
        >
          Não tem conta?{" "}
          <button
            type="button"
            onClick={() => navigate("/escolha-perfil")}
            className="text-primary font-medium hover:underline"
          >
            Criar conta
          </button>
        </motion.p>
      </motion.form>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="relative z-10 px-8 py-8"
      >
        <p className="text-center text-xs text-muted-foreground">
          Ao continuar, você concorda com nossos{" "}
          <span className="text-primary cursor-pointer">Termos de Uso</span> e{" "}
          <span className="text-primary cursor-pointer">Política de Privacidade</span>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;