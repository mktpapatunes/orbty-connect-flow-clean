import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import NetworkBackground from "@/components/NetworkBackground";
import { supabase } from "@/integrations/supabase/client";

const ForgotPassword = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      toast.error("Informe seu e-mail");
      return;
    }

    try {
      setIsSubmitting(true);

      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });

      if (error) {
        toast.error(error.message || "Não foi possível enviar o e-mail de recuperação.");
        return;
      }

      toast.success("Enviamos o link de recuperação para seu e-mail.");
navigate(`/check-email?mode=recovery&email=${encodeURIComponent(normalizedEmail)}`, {replace: true,});
    } catch (error) {
      console.error("[ForgotPassword] reset email error:", error);
      toast.error("Não foi possível enviar o e-mail de recuperação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mobile-container relative flex flex-col bg-background">
      <NetworkBackground />

      <div className="relative z-10 pt-16 pb-8 px-8">
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => navigate("/login")}
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
          Esqueci minha <span className="text-gradient-neon">senha</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-muted-foreground text-sm"
        >
          Informe seu e-mail para receber o link de recuperação
        </motion.p>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        onSubmit={handleSubmit}
        className="relative z-10 flex-1 px-8 space-y-4"
      >
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="email"
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
          />
        </div>

        <motion.button
          type="submit"
          disabled={isSubmitting}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-4 rounded-xl bg-gradient-neon text-primary-foreground font-semibold text-base tracking-wide glow-blue transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Enviar link de recuperação"}
        </motion.button>

        <button
          type="button"
          onClick={() => navigate("/login")}
          className="w-full py-3 rounded-xl border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para login
        </button>
      </motion.form>
    </div>
  );
};

export default ForgotPassword;